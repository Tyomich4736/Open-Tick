import { addDays, endOfDay, startOfDay } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import type Database from 'better-sqlite3'
import type { TaskFilter } from '@shared/filters'
import { instantToFilterIso } from '@shared/taskDates'
import type {
  CreateTaskInput,
  Priority,
  Task,
  TaskListItem,
  TaskStatus,
  SyncStatus,
  UpdateTaskInput,
} from '@shared/entities'
import type { RecurrenceRule, ReminderInput } from '@shared/recurrence'
import { nextOccurrenceDates } from '@shared/nextOccurrence'
import type { SettingsRepository } from './SettingsRepository'
import type { TagRepository } from './TagRepository'
import type { TaskReminderRepository } from './TaskReminderRepository'
import { asBool, newId, nowIso, toInt } from '../utils'

/** Escape user input for FTS5 MATCH (prefix search on tokens). */
function escapeFtsQuery(raw: string): string {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/["']/g, ''))
    .filter(Boolean)
  if (tokens.length === 0) return '""'
  return tokens.map((t) => `"${t}"*`).join(' ')
}

interface TaskRow {
  id: string
  remote_id: string | null
  project_id: string
  parent_id: string | null
  title: string
  content: string
  priority: Priority
  status: TaskStatus
  due_date: string | null
  start_date: string | null
  is_all_day: number
  time_zone: string | null
  recurrence_rule: string | null
  recurrence_parent_id: string | null
  sort_order: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface TaskListRow {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  due_date: string | null
  start_date: string | null
  is_all_day: number
  project_id: string
  project_name: string
  project_color: string
  project_is_inbox: number
  subtask_count: number
  completed_subtask_count: number
  created_at: string
  recurrence_rule: string | null
}

function parseRecurrence(raw: string | null): RecurrenceRule | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as RecurrenceRule
  } catch {
    return null
  }
}

function serializeRecurrence(rule: RecurrenceRule | null): string | null {
  return rule ? JSON.stringify(rule) : null
}

function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    remote_id: row.remote_id,
    project_id: row.project_id,
    parent_id: row.parent_id,
    title: row.title,
    content: row.content,
    priority: row.priority,
    status: row.status,
    due_date: row.due_date,
    start_date: row.start_date,
    is_all_day: asBool(row.is_all_day),
    time_zone: row.time_zone,
    recurrence_rule: parseRecurrence(row.recurrence_rule),
    recurrence_parent_id: row.recurrence_parent_id,
    sort_order: row.sort_order,
    sync_status: row.sync_status,
    remote_updated_at: row.remote_updated_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

function toRowParams(task: Task) {
  return {
    ...task,
    is_all_day: toInt(task.is_all_day),
    recurrence_rule: serializeRecurrence(task.recurrence_rule),
  }
}

export class TaskRepository {
  constructor(
    private db: Database.Database,
    private tagRepository: TagRepository,
    private settingsRepository: SettingsRepository,
    private reminderRepository: TaskReminderRepository,
  ) {}

  create(input: CreateTaskInput): Task {
    const project = this.db
      .prepare('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL')
      .get(input.project_id)
    if (!project) throw new Error(`List not found: ${input.project_id}`)

    if (input.parent_id) {
      const parent = this.getById(input.parent_id)
      if (!parent) throw new Error(`Parent task not found: ${input.parent_id}`)
      if (parent.project_id !== input.project_id) {
        throw new Error('Subtask must belong to the same list as its parent')
      }
    }

    const now = nowIso()
    const sortOrder =
      (
        this.db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM tasks
             WHERE project_id = ? AND deleted_at IS NULL AND parent_id IS ?`,
          )
          .get(input.project_id, input.parent_id ?? null) as { next: number }
      ).next ?? 0

    const task: Task = {
      id: newId(),
      remote_id: null,
      project_id: input.project_id,
      parent_id: input.parent_id ?? null,
      title: input.title,
      content: input.content ?? '',
      priority: input.priority ?? 0,
      status: 'pending',
      due_date: input.due_date ?? null,
      start_date: input.start_date ?? null,
      is_all_day: input.is_all_day ?? true,
      time_zone: input.time_zone ?? null,
      recurrence_rule: input.recurrence_rule ?? null,
      recurrence_parent_id: null,
      sort_order: sortOrder,
      sync_status: 'pending_create',
      remote_updated_at: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    this.db
      .prepare(
        `INSERT INTO tasks (
          id, remote_id, project_id, parent_id, title, content, priority, status,
          due_date, start_date, is_all_day, time_zone, recurrence_rule, recurrence_parent_id,
          sort_order, sync_status, remote_updated_at, completed_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @project_id, @parent_id, @title, @content, @priority, @status,
          @due_date, @start_date, @is_all_day, @time_zone, @recurrence_rule, @recurrence_parent_id,
          @sort_order, @sync_status, @remote_updated_at, @completed_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run(toRowParams(task))

    if (input.tags?.length) {
      this.tagRepository.setTaskTags(task.id, input.tags)
    }
    if (input.reminders?.length) {
      this.reminderRepository.replaceForTask(task.id, input.reminders)
    }

    return task
  }

  update(id: string, input: UpdateTaskInput): Task {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Task not found: ${id}`)

    if (input.project_id && input.project_id !== existing.project_id) {
      const project = this.db
        .prepare('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL')
        .get(input.project_id)
      if (!project) throw new Error(`List not found: ${input.project_id}`)
    }

    if (input.parent_id !== undefined) {
      this.assertValidParent(id, input.parent_id)
    }

    if (input.parent_id) {
      const parent = this.getById(input.parent_id)
      if (!parent) throw new Error(`Parent task not found: ${input.parent_id}`)
      if (input.project_id === undefined) {
        input = { ...input, project_id: parent.project_id }
      } else if (input.project_id !== parent.project_id) {
        throw new Error('Subtask must belong to the same list as its parent')
      }
    }

    const isRecurring =
      Boolean(existing.recurrence_rule) || Boolean(existing.recurrence_parent_id)
    const editThisOnly = input.recurrence_edit_scope === 'this' && isRecurring

    let recurrence_rule =
      input.recurrence_rule !== undefined ? input.recurrence_rule : existing.recurrence_rule
    let recurrence_parent_id = existing.recurrence_parent_id

    if (editThisOnly) {
      recurrence_rule = null
      recurrence_parent_id = existing.recurrence_parent_id ?? existing.id
    }

    const updated: Task = {
      ...existing,
      title: input.title ?? existing.title,
      project_id: input.project_id ?? existing.project_id,
      content: input.content ?? existing.content,
      priority: input.priority ?? existing.priority,
      due_date: input.due_date !== undefined ? input.due_date : existing.due_date,
      start_date: input.start_date !== undefined ? input.start_date : existing.start_date,
      is_all_day: input.is_all_day ?? existing.is_all_day,
      time_zone: input.time_zone !== undefined ? input.time_zone : existing.time_zone,
      parent_id: input.parent_id !== undefined ? input.parent_id : existing.parent_id,
      recurrence_rule,
      recurrence_parent_id,
      updated_at: nowIso(),
      sync_status: existing.remote_id ? 'pending_update' : 'pending_create',
    }

    this.db
      .prepare(
        `UPDATE tasks SET
          title = @title, project_id = @project_id, content = @content, priority = @priority,
          due_date = @due_date, start_date = @start_date, is_all_day = @is_all_day,
          time_zone = @time_zone, parent_id = @parent_id,
          recurrence_rule = @recurrence_rule, recurrence_parent_id = @recurrence_parent_id,
          sync_status = @sync_status, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run(toRowParams(updated))

    if (input.tags) {
      this.tagRepository.setTaskTags(id, input.tags)
    }
    if (input.reminders) {
      // Fresh reminder rows → clear fire state by not preserving notified
      this.reminderRepository.replaceForTask(id, input.reminders)
    } else {
      const dueChanged =
        input.due_date !== undefined && input.due_date !== existing.due_date
      const startChanged =
        input.start_date !== undefined && input.start_date !== existing.start_date
      const allDayChanged =
        input.is_all_day !== undefined && input.is_all_day !== existing.is_all_day
      if (dueChanged || startChanged || allDayChanged) {
        // Reschedule: allow desktop notifications to fire for the new time
        this.reminderRepository.clearNotifiedForTask(id)
      }
    }

    return updated
  }

  /** Walk ancestors to prevent cycles when reparenting. */
  private assertValidParent(taskId: string, parentId: string | null): void {
    if (!parentId) return
    if (parentId === taskId) {
      throw new Error('Task cannot be its own parent')
    }
    let current: string | null = parentId
    const seen = new Set<string>()
    while (current) {
      if (current === taskId) {
        throw new Error('Cannot nest a task under its own subtask')
      }
      if (seen.has(current)) break
      seen.add(current)
      current = this.getById(current)?.parent_id ?? null
    }
    const parent = this.getById(parentId)
    if (!parent) throw new Error(`Parent task not found: ${parentId}`)
  }

  complete(id: string): Task {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Task not found: ${id}`)
    // Idempotent — re-completing must not spawn another occurrence.
    if (existing.status === 'completed') return existing

    const now = nowIso()
    const updated: Task = {
      ...existing,
      status: 'completed',
      completed_at: now,
      updated_at: now,
      sync_status: existing.remote_id ? 'pending_update' : 'pending_create',
    }

    const run = () => {
      // Re-check inside the transaction to avoid double-spawn races.
      const current = this.getById(id)
      if (!current || current.status === 'completed') return current ?? updated

      this.db
        .prepare(
          `UPDATE tasks SET status = @status, completed_at = @completed_at,
           sync_status = @sync_status, updated_at = @updated_at WHERE id = @id`,
        )
        .run(updated)

      if (current.recurrence_rule) {
        this.spawnNextOccurrence(current, now)
      }

      return updated
    }

    return this.db.inTransaction ? run() : this.db.transaction(run)()
  }

  private spawnNextOccurrence(completed: Task, completedAt: string): Task | null {
    const rule = completed.recurrence_rule
    if (!rule) return null

    const next = nextOccurrenceDates(rule, {
      due_date: completed.due_date,
      start_date: completed.start_date,
      completed_at: completedAt,
    })
    if (!next) return null

    const seriesRoot = completed.recurrence_parent_id ?? completed.id
    const tags = this.tagRepository.getTagsForTask(completed.id)

    const nextTask = this.create({
      title: completed.title,
      project_id: completed.project_id,
      content: completed.content,
      priority: completed.priority,
      due_date: next.due_date,
      start_date: next.start_date,
      is_all_day: completed.is_all_day,
      time_zone: completed.time_zone,
      parent_id: completed.parent_id,
      tags,
      recurrence_rule: next.rule,
    })

    this.db
      .prepare(
        `UPDATE tasks SET recurrence_parent_id = @recurrence_parent_id, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run({
        id: nextTask.id,
        recurrence_parent_id: seriesRoot,
        updated_at: nowIso(),
      })

    this.reminderRepository.copyToTask(completed.id, nextTask.id)

    return { ...nextTask, recurrence_parent_id: seriesRoot }
  }

  uncomplete(id: string): Task {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Task not found: ${id}`)
    if (existing.status !== 'completed') return existing

    const now = nowIso()
    const updated: Task = {
      ...existing,
      status: 'pending',
      completed_at: null,
      updated_at: now,
      sync_status: existing.remote_id ? 'pending_update' : 'pending_create',
    }

    const run = () => {
      const current = this.getById(id)
      if (!current || current.status !== 'completed') return current ?? updated

      // Completing a recurring task spawns the next occurrence. Undo that spawn
      // when the user unchecks, so we don't leave a duplicate pending task.
      if (current.recurrence_rule && current.completed_at) {
        const seriesRoot = current.recurrence_parent_id ?? current.id
        const spawned = this.db
          .prepare(
            `SELECT id FROM tasks
             WHERE deleted_at IS NULL
               AND status = 'pending'
               AND recurrence_parent_id = ?
               AND title = ?
               AND created_at >= ?
             ORDER BY created_at ASC
             LIMIT 1`,
          )
          .get(seriesRoot, current.title, current.completed_at) as { id: string } | undefined
        if (spawned) {
          this.db
            .prepare(
              `UPDATE tasks SET deleted_at = @deleted_at, updated_at = @updated_at, sync_status = @sync_status
               WHERE id = @id`,
            )
            .run({
              id: spawned.id,
              deleted_at: now,
              updated_at: now,
              sync_status: 'synced',
            })
        }
      }

      this.db
        .prepare(
          `UPDATE tasks SET status = @status, completed_at = NULL,
           sync_status = @sync_status, updated_at = @updated_at WHERE id = @id`,
        )
        .run(updated)

      return updated
    }

    return this.db.inTransaction ? run() : this.db.transaction(run)()
  }

  reorder(orderedIds: string[]): void {
    const apply = this.db.transaction(() => {
      const now = nowIso()
      orderedIds.forEach((id, index) => {
        const existing = this.getById(id)
        if (!existing) throw new Error(`Task not found: ${id}`)
        this.db
          .prepare(
            `UPDATE tasks SET sort_order = @sort_order, updated_at = @updated_at,
             sync_status = @sync_status WHERE id = @id`,
          )
          .run({
            id,
            sort_order: index,
            updated_at: now,
            sync_status: existing.remote_id ? 'pending_update' : existing.sync_status,
          })
      })
    })
    apply()
  }

  softDelete(id: string): void {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Task not found: ${id}`)

    const now = nowIso()
    this.db
      .prepare(
        `UPDATE tasks SET deleted_at = @deleted_at, updated_at = @updated_at, sync_status = @sync_status
         WHERE id = @id`,
      )
      .run({
        id,
        deleted_at: now,
        updated_at: now,
        sync_status: existing.remote_id ? 'pending_delete' : 'synced',
      })
  }

  bulkUpdate(
    ids: string[],
    patch: {
      due_date?: string | null
      start_date?: string | null
      is_all_day?: boolean
      priority?: Priority
      project_id?: string
      add_tags?: string[]
      remove_tags?: string[]
    },
  ): Record<string, string[]> {
    const uniqueIds = [...new Set(ids)]
    const tagsById: Record<string, string[]> = {}
    if (uniqueIds.length === 0) return tagsById

    // No outer transaction — each update commits immediately (avoids nested txn issues
    // and matches the proven single-task update path).
    for (const id of uniqueIds) {
      if (!this.getById(id)) continue

      const input: UpdateTaskInput = {}
      if (patch.due_date !== undefined) input.due_date = patch.due_date
      if (patch.start_date !== undefined) input.start_date = patch.start_date
      if (patch.is_all_day !== undefined) input.is_all_day = patch.is_all_day
      if (patch.priority !== undefined) input.priority = patch.priority
      if (patch.project_id !== undefined) input.project_id = patch.project_id

      if (patch.add_tags?.length || patch.remove_tags?.length) {
        let next = this.tagRepository.getTagsForTask(id)
        if (patch.add_tags?.length) {
          const set = new Set(next)
          for (const t of patch.add_tags) set.add(t)
          next = [...set]
        }
        if (patch.remove_tags?.length) {
          const remove = new Set(patch.remove_tags)
          next = next.filter((t) => !remove.has(t))
        }
        input.tags = next
      }

      if (Object.keys(input).length > 0) {
        this.update(id, input)
      }
      tagsById[id] = this.tagRepository.getTagsForTask(id)
    }

    return tagsById
  }

  bulkComplete(ids: string[], completed: boolean): void {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return

    const apply = this.db.transaction(() => {
      for (const id of uniqueIds) {
        const task = this.getById(id)
        if (!task) continue
        if (completed && task.status !== 'completed') this.complete(id)
        if (!completed && task.status === 'completed') this.uncomplete(id)
      }
    })
    apply()
  }

  bulkDelete(ids: string[]): void {
    const uniqueIds = [...new Set(ids)]
    if (uniqueIds.length === 0) return

    const apply = this.db.transaction(() => {
      for (const id of uniqueIds) {
        if (this.getById(id)) this.softDelete(id)
      }
    })
    apply()
  }

  /** Shallow clone: same list/parent, tags, reminders; title gets " (copy)". */
  duplicate(id: string): Task {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Task not found: ${id}`)
    const tags = this.tagRepository.getTagsForTask(id)
    const reminders = this.reminderRepository.listForTask(id)
    return this.create({
      title: `${existing.title} (copy)`,
      project_id: existing.project_id,
      parent_id: existing.parent_id,
      content: existing.content,
      priority: existing.priority,
      due_date: existing.due_date,
      start_date: existing.start_date,
      is_all_day: existing.is_all_day,
      time_zone: existing.time_zone,
      recurrence_rule: existing.recurrence_rule,
      tags,
      reminders: reminders.map((r) => ({
        kind: r.kind,
        offset_minutes: r.offset_minutes,
      })),
    })
  }

  getById(id: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL')
      .get(id) as TaskRow | undefined
    return row ? mapTask(row) : null
  }

  getByRemoteId(remoteId: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE remote_id = ? AND deleted_at IS NULL LIMIT 1')
      .get(remoteId) as TaskRow | undefined
    return row ? mapTask(row) : null
  }

  /**
   * Synced pending tasks with a remote id — candidates when `/data` dropped them
   * after remote complete/delete.
   */
  listSyncedPendingWithRemote(projectId: string): Array<{ id: string; remote_id: string }> {
    return this.db
      .prepare(
        `SELECT id, remote_id FROM tasks
         WHERE project_id = ?
           AND deleted_at IS NULL
           AND status = 'pending'
           AND sync_status = 'synced'
           AND remote_id IS NOT NULL`,
      )
      .all(projectId) as Array<{ id: string; remote_id: string }>
  }

  /** Remote row is gone — drop locally without queuing an outbound delete. */
  markRemovedFromRemote(id: string): void {
    const now = nowIso()
    this.db
      .prepare(
        `UPDATE tasks SET deleted_at = ?, updated_at = ?, sync_status = 'synced' WHERE id = ?`,
      )
      .run(now, now, id)
  }

  /** Pending outbound rows (includes soft-deleted pending_delete). */
  listPendingSync(): Task[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM tasks
         WHERE sync_status IN ('pending_create', 'pending_update', 'pending_delete')
         ORDER BY parent_id IS NOT NULL ASC, created_at ASC`,
      )
      .all() as TaskRow[]
    return rows.map(mapTask)
  }

  /** UI summary for Integration panel — roots first, then subtasks. */
  listPendingSyncSummary(): Array<{
    id: string
    title: string
    sync_status: 'pending_create' | 'pending_update' | 'pending_delete'
    project_id: string
    project_name: string
    project_is_inbox: boolean
    deleted: boolean
  }> {
    const rows = this.db
      .prepare(
        `SELECT
           t.id,
           t.title,
           t.sync_status,
           t.project_id,
           t.deleted_at,
           p.name as project_name,
           p.is_inbox as project_is_inbox
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE t.sync_status IN ('pending_create', 'pending_update', 'pending_delete')
         ORDER BY t.parent_id IS NOT NULL ASC, t.updated_at DESC`,
      )
      .all() as Array<{
      id: string
      title: string
      sync_status: 'pending_create' | 'pending_update' | 'pending_delete'
      project_id: string
      deleted_at: string | null
      project_name: string
      project_is_inbox: number
    }>

    return rows.map((row) => ({
      id: row.id,
      title: row.title.trim() || 'Untitled',
      sync_status: row.sync_status,
      project_id: row.project_id,
      project_name: row.project_name,
      project_is_inbox: asBool(row.project_is_inbox),
      deleted: row.deleted_at != null || row.sync_status === 'pending_delete',
    }))
  }

  markSynced(id: string, remoteId?: string | null): void {
    const now = nowIso()
    if (remoteId) {
      this.db
        .prepare(
          `UPDATE tasks SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
        )
        .run(remoteId, now, id)
    } else {
      this.db
        .prepare(`UPDATE tasks SET sync_status = 'synced', updated_at = ? WHERE id = ?`)
        .run(now, id)
    }
  }

  hardDelete(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  private getByRemoteIdAny(remoteId: string): Task | null {
    const row = this.db
      .prepare('SELECT * FROM tasks WHERE remote_id = ? LIMIT 1')
      .get(remoteId) as TaskRow | undefined
    return row ? mapTask(row) : null
  }

  /**
   * Inbound pull upsert. Skips dirty local rows; revives soft-deleted matches.
   * parent_id must already be resolved to a local id (or null).
   */
  upsertFromRemote(input: {
    remote_id: string
    project_id: string
    parent_id: string | null
    title: string
    content: string
    priority: Priority
    status: TaskStatus
    due_date: string | null
    start_date: string | null
    is_all_day: boolean
    time_zone: string | null
    recurrence_rule: RecurrenceRule | null
    sort_order: number
    remote_updated_at: string | null
    completed_at: string | null
    tags: string[]
    reminders: ReminderInput[]
  }): Task {
    const existing = this.getByRemoteIdAny(input.remote_id)
    const now = nowIso()

    if (existing) {
      // Soft-deleted after local cleanup — revive from remote.
      if (existing.deleted_at) {
        const revived: Task = {
          ...existing,
          project_id: input.project_id,
          parent_id: input.parent_id,
          title: input.title,
          content: input.content,
          priority: input.priority,
          status: input.status,
          due_date: input.due_date,
          start_date: input.start_date,
          is_all_day: input.is_all_day,
          time_zone: input.time_zone,
          recurrence_rule: input.recurrence_rule,
          sort_order: input.sort_order,
          remote_updated_at: input.remote_updated_at,
          completed_at: input.status === 'completed' ? input.completed_at : null,
          sync_status: 'synced',
          updated_at: now,
          deleted_at: null,
        }
        this.db
          .prepare(
            `UPDATE tasks SET
              project_id = @project_id, parent_id = @parent_id,
              title = @title, content = @content,
              priority = @priority, status = @status, due_date = @due_date, start_date = @start_date,
              is_all_day = @is_all_day, time_zone = @time_zone, recurrence_rule = @recurrence_rule,
              sort_order = @sort_order, remote_updated_at = @remote_updated_at,
              completed_at = @completed_at, sync_status = @sync_status, updated_at = @updated_at,
              deleted_at = NULL
             WHERE id = @id`,
          )
          .run(toRowParams(revived))
        this.tagRepository.setTaskTags(revived.id, input.tags)
        this.reminderRepository.replaceForTask(revived.id, input.reminders, {
          preserveNotified: true,
        })
        return revived
      }
      if (existing.sync_status !== 'synced') return existing

      const updated: Task = {
        ...existing,
        project_id: input.project_id,
        parent_id: input.parent_id,
        title: input.title,
        content: input.content,
        priority: input.priority,
        status: input.status,
        due_date: input.due_date,
        start_date: input.start_date,
        is_all_day: input.is_all_day,
        time_zone: input.time_zone,
        recurrence_rule: input.recurrence_rule,
        sort_order: input.sort_order,
        remote_updated_at: input.remote_updated_at,
        completed_at: input.status === 'completed' ? input.completed_at ?? existing.completed_at : null,
        sync_status: 'synced',
        updated_at: now,
      }

      this.db
        .prepare(
          `UPDATE tasks SET
            project_id = @project_id, parent_id = @parent_id,
            title = @title, content = @content,
            priority = @priority, status = @status, due_date = @due_date, start_date = @start_date,
            is_all_day = @is_all_day, time_zone = @time_zone, recurrence_rule = @recurrence_rule,
            sort_order = @sort_order, remote_updated_at = @remote_updated_at,
            completed_at = @completed_at, sync_status = @sync_status, updated_at = @updated_at
           WHERE id = @id`,
        )
        .run(toRowParams(updated))

      this.tagRepository.setTaskTags(updated.id, input.tags)
      const dueChanged = existing.due_date !== input.due_date
      this.reminderRepository.replaceForTask(updated.id, input.reminders, {
        preserveNotified: !dueChanged,
      })
      return updated
    }

    const task: Task = {
      id: newId(),
      remote_id: input.remote_id,
      project_id: input.project_id,
      parent_id: input.parent_id,
      title: input.title,
      content: input.content,
      priority: input.priority,
      status: input.status,
      due_date: input.due_date,
      start_date: input.start_date,
      is_all_day: input.is_all_day,
      time_zone: input.time_zone,
      recurrence_rule: input.recurrence_rule,
      recurrence_parent_id: null,
      sort_order: input.sort_order,
      sync_status: 'synced',
      remote_updated_at: input.remote_updated_at,
      completed_at: input.status === 'completed' ? input.completed_at : null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    this.db
      .prepare(
        `INSERT INTO tasks (
          id, remote_id, project_id, parent_id, title, content, priority, status,
          due_date, start_date, is_all_day, time_zone, recurrence_rule, recurrence_parent_id,
          sort_order, sync_status, remote_updated_at, completed_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @project_id, @parent_id, @title, @content, @priority, @status,
          @due_date, @start_date, @is_all_day, @time_zone, @recurrence_rule, @recurrence_parent_id,
          @sort_order, @sync_status, @remote_updated_at, @completed_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run(toRowParams(task))

    this.tagRepository.setTaskTags(task.id, input.tags)
    this.reminderRepository.replaceForTask(task.id, input.reminders)
    return task
  }

  list(filter: TaskFilter = {}): TaskListItem[] {
    const { where, params, orderBy } = this.buildFilterQuery(filter)
    const rows = this.db
      .prepare(
        `SELECT
          t.id, t.title, t.status, t.priority, t.due_date, t.start_date, t.is_all_day,
          t.project_id, t.created_at, t.recurrence_rule,
          p.name as project_name, p.color as project_color, p.is_inbox as project_is_inbox,
          COALESCE(sc.subtask_count, 0) as subtask_count,
          COALESCE(sc.completed_subtask_count, 0) as completed_subtask_count
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         LEFT JOIN (
           SELECT
             parent_id,
             COUNT(*) as subtask_count,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_subtask_count
           FROM tasks
           WHERE deleted_at IS NULL AND parent_id IS NOT NULL
           GROUP BY parent_id
         ) sc ON sc.parent_id = t.id
         WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
         ${where}
         ORDER BY ${orderBy}`,
      )
      .all(...params) as TaskListRow[]

    const taskIds = rows.map((row) => row.id)
    const tagsByTask = this.tagRepository.getTagsForTasks(taskIds)

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      due_date: row.due_date,
      start_date: row.start_date,
      is_all_day: asBool(row.is_all_day),
      project_id: row.project_id,
      project_name: row.project_name,
      // Inbox has no list color; calendar highlights via project_is_inbox
      project_color: asBool(row.project_is_inbox) ? '' : row.project_color,
      project_is_inbox: asBool(row.project_is_inbox),
      tags: tagsByTask.get(row.id) ?? [],
      subtask_count: row.subtask_count,
      completed_subtask_count: row.completed_subtask_count,
      created_at: row.created_at,
      recurrence_rule: parseRecurrence(row.recurrence_rule),
    }))
  }

  /** Count matching tasks without loading rows (sidebar badges, etc.). */
  count(filter: TaskFilter = {}): number {
    const { where, params } = this.buildFilterQuery(filter)
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as c
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE t.deleted_at IS NULL AND p.deleted_at IS NULL
         ${where}`,
      )
      .get(...params) as { c: number }
    return row?.c ?? 0
  }

  private buildFilterQuery(filter: TaskFilter): {
    where: string
    params: unknown[]
    orderBy: string
  } {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter.parent_id === null) {
      clauses.push('t.parent_id IS NULL')
    } else if (filter.parent_id !== undefined) {
      clauses.push('t.parent_id = ?')
      params.push(filter.parent_id)
    } else if (!filter.search) {
      clauses.push('t.parent_id IS NULL')
    }

    if (filter.project_id) {
      clauses.push('t.project_id = ?')
      params.push(filter.project_id)
    }

    if (filter.status) {
      clauses.push('t.status = ?')
      params.push(filter.status)
    }

    if (filter.tag) {
      clauses.push(
        `EXISTS (
          SELECT 1 FROM task_tags tt
          INNER JOIN tags tg ON tg.id = tt.tag_id
          WHERE tt.task_id = t.id AND tg.name = ?
        )`,
      )
      params.push(filter.tag)
    }

    if (filter.search) {
      clauses.push(`t.rowid IN (SELECT rowid FROM tasks_fts WHERE tasks_fts MATCH ?)`)
      params.push(escapeFtsQuery(filter.search))
    }

    // Calendar range: task overlaps [due_from, due_to] using duration-aware bounds
    if (filter.due_from && filter.due_to) {
      if (filter.include_recurring_series) {
        clauses.push(`(
          (
            t.due_date IS NOT NULL
            AND COALESCE(t.start_date, t.due_date) <= ?
            AND t.due_date >= ?
          )
          OR (
            t.recurrence_rule IS NOT NULL
            AND t.status = 'pending'
            AND t.due_date IS NOT NULL
          )
        )`)
        params.push(filter.due_to, filter.due_from)
      } else {
        clauses.push('t.due_date IS NOT NULL')
        clauses.push('COALESCE(t.start_date, t.due_date) <= ?')
        clauses.push('t.due_date >= ?')
        params.push(filter.due_to, filter.due_from)
      }
      if (filter.include_completed !== true && !filter.status) {
        clauses.push("t.status = 'pending'")
      }
    }

    if (filter.smart_list) {
      const timezone = this.settingsRepository.getTimezone()
      const zonedNow = toZonedTime(new Date(), timezone)
      const todayStart = fromZonedTime(startOfDay(zonedNow), timezone)
      const todayEnd = fromZonedTime(endOfDay(zonedNow), timezone)
      const tomorrowStart = fromZonedTime(startOfDay(addDays(zonedNow, 1)), timezone)
      const tomorrowEnd = fromZonedTime(endOfDay(addDays(zonedNow, 1)), timezone)
      const weekEnd = fromZonedTime(endOfDay(addDays(zonedNow, 7)), timezone)

      switch (filter.smart_list) {
        case 'inbox':
          clauses.push('p.is_inbox = 1')
          if (filter.include_completed !== true) {
            clauses.push("t.status = 'pending'")
          }
          break
        case 'today': {
          // Pending: due today (overlap) or overdue.
          // Completed (when shown): due today, or completed today — not historical overdue.
          const todayStartIso = instantToFilterIso(todayStart)
          const todayEndIso = instantToFilterIso(todayEnd)
          const overlapsToday =
            '(COALESCE(t.start_date, t.due_date) <= ? AND t.due_date >= ?)'
          if (filter.include_completed === true) {
            clauses.push(`(
              (
                t.status = 'pending'
                AND t.due_date IS NOT NULL
                AND (${overlapsToday} OR t.due_date < ?)
              )
              OR (
                t.status = 'completed'
                AND (
                  (t.due_date IS NOT NULL AND ${overlapsToday})
                  OR (
                    t.completed_at IS NOT NULL
                    AND t.completed_at >= ?
                    AND t.completed_at <= ?
                  )
                )
              )
            )`)
            params.push(
              todayEndIso,
              todayStartIso,
              todayStartIso,
              todayEndIso,
              todayStartIso,
              todayStartIso,
              todayEndIso,
            )
          } else {
            clauses.push('t.due_date IS NOT NULL')
            clauses.push(`(${overlapsToday} OR t.due_date < ?)`)
            params.push(todayEndIso, todayStartIso, todayStartIso)
            clauses.push("t.status = 'pending'")
          }
          break
        }
        case 'tomorrow':
          clauses.push('t.due_date IS NOT NULL')
          clauses.push('COALESCE(t.start_date, t.due_date) <= ?')
          clauses.push('t.due_date >= ?')
          params.push(instantToFilterIso(tomorrowEnd), instantToFilterIso(tomorrowStart))
          if (filter.include_completed !== true) {
            clauses.push("t.status = 'pending'")
          }
          break
        case 'week':
          clauses.push('t.due_date IS NOT NULL')
          clauses.push('COALESCE(t.start_date, t.due_date) <= ?')
          clauses.push('t.due_date >= ?')
          params.push(instantToFilterIso(weekEnd), instantToFilterIso(todayStart))
          if (filter.include_completed !== true) {
            clauses.push("t.status = 'pending'")
          }
          break
        case 'overdue':
          clauses.push('t.due_date IS NOT NULL')
          clauses.push('t.due_date < ?')
          params.push(instantToFilterIso(todayStart))
          clauses.push("t.status = 'pending'")
          break
        case 'completed':
          clauses.push("t.status = 'completed'")
          break
      }
    } else if (filter.include_completed === false && !filter.status && !filter.due_from) {
      clauses.push("t.status = 'pending'")
    }

    const where = clauses.length ? `AND ${clauses.join(' AND ')}` : ''
    const { orderBy, orderParams } = this.resolveOrderBy(filter)
    params.push(...orderParams)

    return { where, params, orderBy }
  }

  private resolveOrderBy(filter: TaskFilter): { orderBy: string; orderParams: unknown[] } {
    if (filter.smart_list === 'completed') {
      return { orderBy: 't.completed_at DESC, t.updated_at DESC', orderParams: [] }
    }

    const sort = filter.sort ?? 'order'

    switch (sort) {
      case 'due_date': {
        const timezone = this.settingsRepository.getTimezone()
        const zonedNow = toZonedTime(new Date(), timezone)
        const todayStartIso = instantToFilterIso(
          fromZonedTime(startOfDay(zonedNow), timezone),
        )
        return {
          orderBy: `
          CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END ASC,
          CASE WHEN t.due_date IS NOT NULL AND t.due_date < ? THEN 0 ELSE 1 END ASC,
          t.due_date ASC,
          t.sort_order ASC
        `,
          orderParams: [todayStartIso],
        }
      }
      case 'title':
        return { orderBy: 't.title COLLATE NOCASE ASC, t.sort_order ASC', orderParams: [] }
      case 'priority':
        return {
          orderBy: 't.priority DESC, t.sort_order ASC, t.created_at DESC',
          orderParams: [],
        }
      case 'order':
      default:
        return { orderBy: 't.sort_order ASC, t.created_at DESC', orderParams: [] }
    }
  }
}
