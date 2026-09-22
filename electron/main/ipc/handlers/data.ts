import type { AppearanceSettings } from '@shared/appearance'
import type {
  BulkTaskPatch,
  CreateFolderInput,
  CreateProjectInput,
  CreateTagInput,
  CreateTaskInput,
  UpdateFolderInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@shared/entities'
import type { TaskFilter } from '@shared/filters'
import { TICKTICK_SETTING_KEYS } from '@shared/ticktickCredentials'
import { getRepositories } from '../../db/connection'
import { notifyChanged } from '../notify'
import { getSyncEngine } from '../../sync/SyncEngine'
import { runIpcHandler } from '../ipcWrapper'
import { closeStickyWindow } from '../../windows/stickyNoteWindow'

export function handleProjectList() {
  return runIpcHandler(() => getRepositories().projects.list())
}

export function handleProjectGet(id: string) {
  return runIpcHandler(() => {
    const project = getRepositories().projects.getById(id)
    if (!project) throw new Error(`List not found: ${id}`)
    return project
  })
}

export function handleProjectCreate(input: CreateProjectInput) {
  return runIpcHandler(() => {
    const project = getRepositories().projects.create(input)
    notifyChanged({ entityType: 'project', entityId: project.id, reason: 'local' })
    getSyncEngine().broadcastStatus()
    return project
  })
}

export function handleProjectUpdate(id: string, input: UpdateProjectInput) {
  return runIpcHandler(() => {
    const project = getRepositories().projects.update(id, input)
    notifyChanged({ entityType: 'project', entityId: project.id, reason: 'local' })
    getSyncEngine().broadcastStatus()
    return project
  })
}

export function handleProjectDelete(id: string) {
  return runIpcHandler(() => {
    getRepositories().projects.softDelete(id)
    notifyChanged({ entityType: 'project', entityId: id, reason: 'local' })
    getSyncEngine().broadcastStatus()
  })
}

export function handleProjectReorder(orderedIds: string[], folderId: string | null = null) {
  return runIpcHandler(() => {
    getRepositories().projects.reorder(orderedIds, folderId)
    notifyChanged({ entityType: 'project', reason: 'local' })
    getSyncEngine().broadcastStatus()
  })
}

export function handleFolderList() {
  return runIpcHandler(() => getRepositories().folders.list())
}

export function handleFolderCreate(input: CreateFolderInput) {
  return runIpcHandler(() => {
    const folder = getRepositories().folders.create(input)
    notifyChanged({ entityType: 'folder', entityId: folder.id, reason: 'local' })
    getSyncEngine().broadcastStatus()
    return folder
  })
}

export function handleFolderUpdate(id: string, input: UpdateFolderInput) {
  return runIpcHandler(() => {
    const folder = getRepositories().folders.update(id, input)
    notifyChanged({ entityType: 'folder', entityId: folder.id, reason: 'local' })
    getSyncEngine().broadcastStatus()
    return folder
  })
}

export function handleFolderDelete(id: string) {
  return runIpcHandler(() => {
    getRepositories().folders.softDelete(id)
    notifyChanged({ entityType: 'folder', entityId: id, reason: 'local' })
    notifyChanged({ entityType: 'project', reason: 'local' })
    getSyncEngine().broadcastStatus()
  })
}

export function handleFolderReorder(orderedIds: string[]) {
  return runIpcHandler(() => {
    getRepositories().folders.reorder(orderedIds)
    notifyChanged({ entityType: 'folder', reason: 'local' })
    getSyncEngine().broadcastStatus()
  })
}

export function handleTaskList(filter?: TaskFilter) {
  return runIpcHandler(() => getRepositories().tasks.list(filter ?? {}))
}

export function handleTaskCount(filter?: TaskFilter) {
  return runIpcHandler(() => getRepositories().tasks.count(filter ?? {}))
}

export function handleTaskGet(id: string) {
  return runIpcHandler(() => {
    const repos = getRepositories()
    const task = repos.tasks.getById(id)
    if (!task) throw new Error(`Task not found: ${id}`)
    const tags = repos.tags.getTagsForTask(id)
    const reminders = repos.reminders.listForTask(id)
    return { ...task, tags, reminders }
  })
}

export function handleTaskCreate(input: CreateTaskInput) {
  return runIpcHandler(() => {
    const task = getRepositories().tasks.create(input)
    notifyChanged({ entityType: 'task', entityId: task.id, reason: 'local' })
    return task
  })
}

export function handleTaskUpdate(id: string, input: UpdateTaskInput) {
  return runIpcHandler(() => {
    const task = getRepositories().tasks.update(id, input)
    notifyChanged({ entityType: 'task', entityId: task.id, reason: 'local' })
    return task
  })
}

export function handleTaskComplete(id: string) {
  return runIpcHandler(() => {
    const task = getRepositories().tasks.complete(id)
    notifyChanged({ entityType: 'task', entityId: task.id, reason: 'local' })
    return task
  })
}

export function handleTaskUncomplete(id: string) {
  return runIpcHandler(() => {
    const task = getRepositories().tasks.uncomplete(id)
    notifyChanged({ entityType: 'task', entityId: task.id, reason: 'local' })
    return task
  })
}

export function handleTaskReorder(orderedIds: string[]) {
  return runIpcHandler(() => {
    getRepositories().tasks.reorder(orderedIds)
    notifyChanged({ entityType: 'task', reason: 'local' })
  })
}

export function handleTaskDelete(id: string) {
  return runIpcHandler(() => {
    getRepositories().tasks.softDelete(id)
    closeStickyWindow(id)
    notifyChanged({ entityType: 'task', entityId: id, reason: 'local' })
  })
}

export function handleTaskDuplicate(id: string) {
  return runIpcHandler(() => {
    const task = getRepositories().tasks.duplicate(id)
    notifyChanged({ entityType: 'task', entityId: task.id, reason: 'local' })
    return task
  })
}

export function handleTaskBulkUpdate(ids: string[], patch: BulkTaskPatch) {
  return runIpcHandler(() => {
    const tagsById = getRepositories().tasks.bulkUpdate(ids, patch)
    notifyChanged({ entityType: 'task', reason: 'local' })
    return tagsById
  })
}

export function handleTaskBulkDelete(ids: string[]) {
  return runIpcHandler(() => {
    getRepositories().tasks.bulkDelete(ids)
    for (const id of ids) closeStickyWindow(id)
    notifyChanged({ entityType: 'task', reason: 'local' })
  })
}

export function handleTaskBulkComplete(ids: string[], completed: boolean) {
  return runIpcHandler(() => {
    getRepositories().tasks.bulkComplete(ids, completed)
    notifyChanged({ entityType: 'task', reason: 'local' })
  })
}

export function handleTagList() {
  return runIpcHandler(() => getRepositories().tags.list())
}

export function handleTagCreate(input: CreateTagInput) {
  return runIpcHandler(() => {
    const tag = getRepositories().tags.create(input)
    notifyChanged({ entityType: 'tag', entityId: tag.id, reason: 'local' })
    return tag
  })
}

export function handleSettingsGet<T = unknown>(key: string) {
  return runIpcHandler(() => getRepositories().settings.get<T>(key))
}

export function handleSettingsSet(key: string, value: unknown) {
  return runIpcHandler(() => {
    getRepositories().settings.set(key, value)
    if (key === TICKTICK_SETTING_KEYS.pushEnabled) {
      getSyncEngine().broadcastStatus()
    }
  })
}

export function handleSettingsGetAppearance() {
  return runIpcHandler(() => getRepositories().settings.getAppearance())
}

export function handleSettingsSetAppearance(partial: Partial<AppearanceSettings>) {
  return runIpcHandler(() => getRepositories().settings.setAppearance(partial))
}

