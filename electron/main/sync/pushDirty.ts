import type { Project, ProjectFolder, Task } from '@shared/entities'
import { getRepositories } from '../db/connection'
import { getTickTickClient, TickTickApiError } from '../ticktick/TickTickClient'
import {
  extractRemoteId,
  localFolderToRemote,
  localProjectToRemote,
  localTaskToRemote,
} from './mappers'

export interface PushResult {
  ran: boolean
  processed: number
  errors: string[]
}

type ProgressFn = (message: string, current: number, total: number) => void

function sortTasksParentsFirst(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const result: Task[] = []
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function visit(task: Task): void {
    if (visited.has(task.id)) return
    if (visiting.has(task.id)) return
    visiting.add(task.id)
    if (task.parent_id) {
      const parent = byId.get(task.parent_id)
      if (parent) visit(parent)
    }
    visiting.delete(task.id)
    visited.add(task.id)
    result.push(task)
  }

  for (const task of tasks) visit(task)
  return result
}

/**
 * Push all locally dirty (pending_*) folders → projects → tasks to TickTick.
 * Caller must gate on push_enabled.
 */
export async function pushDirtyEntities(onProgress?: ProgressFn): Promise<PushResult> {
  const repos = getRepositories()
  const client = getTickTickClient()
  client.refreshConfig()

  const folders = repos.folders.listPendingSync()
  const projects = repos.projects.listPendingSync()
  const tasks = sortTasksParentsFirst(repos.tasks.listPendingSync())

  const total = folders.length + projects.length + tasks.length
  if (total === 0) {
    return { ran: true, processed: 0, errors: [] }
  }

  const errors: string[] = []
  let processed = 0
  let index = 0

  const tick = (label: string) => {
    index += 1
    onProgress?.(label, index, total)
  }

  for (const folder of folders) {
    tick(`Pushing folder “${folder.name}”`)
    try {
      await pushFolder(folder)
      processed += 1
    } catch (error) {
      errors.push(formatError('folder', folder.name, error))
      if (isAuthError(error)) break
    }
  }

  for (const project of projects) {
    tick(`Pushing list “${project.name}”`)
    try {
      await pushProject(project)
      processed += 1
    } catch (error) {
      errors.push(formatError('list', project.name, error))
      if (isAuthError(error)) break
    }
  }

  for (const task of tasks) {
    tick(`Pushing task “${task.title}”`)
    try {
      await pushTask(task)
      processed += 1
    } catch (error) {
      errors.push(formatError('task', task.title, error))
      if (isAuthError(error)) break
    }
  }

  return { ran: true, processed, errors }
}

async function pushFolder(folder: ProjectFolder): Promise<void> {
  const repos = getRepositories()
  const client = getTickTickClient()
  const payload = localFolderToRemote(folder)

  if (folder.sync_status === 'pending_delete') {
    if (folder.remote_id) {
      await client.deleteFolder(folder.remote_id)
    }
    repos.folders.hardDelete(folder.id)
    return
  }

  if (folder.sync_status === 'pending_create' || !folder.remote_id) {
    const response = await client.createFolder(payload)
    const remoteId = extractRemoteId(response)
    if (!remoteId) throw new Error('Create folder succeeded but response had no id')
    repos.folders.markSynced(folder.id, remoteId)
    return
  }

  await client.updateFolder(folder.remote_id, payload)
  repos.folders.markSynced(folder.id)
}

async function pushProject(project: Project): Promise<void> {
  const repos = getRepositories()
  const client = getTickTickClient()

  let groupRemoteId: string | null = null
  if (project.folder_id) {
    const folder = repos.folders.getById(project.folder_id)
    groupRemoteId = folder?.remote_id ?? null
    if (folder && !groupRemoteId) {
      throw new Error(`Folder “${folder.name}” is not synced yet — push folders first`)
    }
  }

  const payload = localProjectToRemote({
    name: project.name,
    color: project.color,
    view_mode: project.view_mode,
    kind: project.kind,
    sort_order: project.sort_order,
    groupRemoteId,
  })

  if (project.sync_status === 'pending_delete') {
    if (project.remote_id) {
      await client.deleteProject(project.remote_id)
    }
    repos.projects.hardDelete(project.id)
    return
  }

  if (project.sync_status === 'pending_create' || !project.remote_id) {
    const response = await client.createProject(payload)
    const remoteId = extractRemoteId(response)
    if (!remoteId) throw new Error('Create list succeeded but response had no id')
    repos.projects.markSynced(project.id, remoteId)
    return
  }

  await client.updateProject(project.remote_id, payload)
  repos.projects.markSynced(project.id)
}

async function pushTask(task: Task): Promise<void> {
  const repos = getRepositories()
  const client = getTickTickClient()

  const projectRow = repos.db
    .prepare('SELECT remote_id, name, is_inbox FROM projects WHERE id = ?')
    .get(task.project_id) as
    | { remote_id: string | null; name: string; is_inbox: number }
    | undefined

  let resolvedProjectRemote = projectRow?.remote_id ?? null
  if (!resolvedProjectRemote && projectRow?.is_inbox) {
    const state = repos.db
      .prepare('SELECT inbox_remote_id FROM sync_state WHERE id = 1')
      .get() as { inbox_remote_id: string | null } | undefined
    resolvedProjectRemote = state?.inbox_remote_id ?? null
  }

  if (task.sync_status === 'pending_delete') {
    if (task.remote_id && resolvedProjectRemote) {
      await client.deleteTask(resolvedProjectRemote, task.remote_id)
    }
    repos.tasks.hardDelete(task.id)
    return
  }

  if (!resolvedProjectRemote) {
    throw new Error(
      `List for task “${task.title}” has no TickTick id yet — push the list first`,
    )
  }

  let parentRemoteId: string | null = null
  if (task.parent_id) {
    const parent = repos.tasks.getById(task.parent_id)
    parentRemoteId = parent?.remote_id ?? null
    if (parent && !parentRemoteId) {
      throw new Error(`Parent task “${parent.title}” is not synced yet`)
    }
  }

  const tags = repos.tags.getTagsForTask(task.id)
  const reminders = repos.reminders.listForTask(task.id).map((r) => ({
    kind: r.kind,
    offset_minutes: r.offset_minutes,
  }))

  const payload = localTaskToRemote({
    title: task.title,
    content: task.content,
    projectRemoteId: resolvedProjectRemote,
    parentRemoteId,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
    start_date: task.start_date,
    is_all_day: task.is_all_day,
    time_zone: task.time_zone,
    tags,
    reminders,
    recurrence_rule: task.recurrence_rule,
    sort_order: task.sort_order,
  })

  if (task.sync_status === 'pending_create' || !task.remote_id) {
    const response = await client.createTask(payload)
    const remoteId = extractRemoteId(response)
    if (!remoteId) throw new Error('Create task succeeded but response had no id')
    repos.tasks.markSynced(task.id, remoteId)

    if (task.status === 'completed') {
      await client.completeTask(resolvedProjectRemote, remoteId)
    }
    return
  }

  await client.updateTask(task.remote_id, payload)

  if (task.status === 'completed') {
    try {
      await client.completeTask(resolvedProjectRemote, task.remote_id)
    } catch (error) {
      // Already completed remotely is fine
      if (!(error instanceof TickTickApiError && error.status === 400)) throw error
    }
  }

  repos.tasks.markSynced(task.id)
}

function formatError(kind: string, name: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return `${kind} “${name}”: ${message}`
}

function isAuthError(error: unknown): boolean {
  return error instanceof TickTickApiError && error.status === 401
}
