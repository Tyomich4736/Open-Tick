import type { RecurrenceRule, ReminderInput, TaskReminder } from './recurrence'

export type SyncStatus =
  | 'synced'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'conflict'

export type TaskStatus = 'pending' | 'completed'

export type Priority = 0 | 1 | 3 | 5

export type ProjectViewMode = 'list' | 'kanban' | 'timeline'

export interface Project {
  id: string
  remote_id: string | null
  folder_id: string | null
  name: string
  color: string
  view_mode: ProjectViewMode
  kind: string
  is_inbox: boolean
  sort_order: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface ProjectFolder {
  id: string
  remote_id: string | null
  name: string
  sort_order: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Task {
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
  is_all_day: boolean
  time_zone: string | null
  recurrence_rule: RecurrenceRule | null
  recurrence_parent_id: string | null
  sort_order: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Tag {
  id: string
  name: string
  color: string | null
  created_at: string
}

export interface TaskListItem {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  due_date: string | null
  start_date: string | null
  is_all_day: boolean
  project_id: string
  project_name: string
  project_color: string
  /** True when the task lives in Inbox (no list color bar; calendar uses dashed accent). */
  project_is_inbox: boolean
  tags: string[]
  subtask_count: number
  completed_subtask_count: number
  /** Present when list query includes recurrence (calendar expansion). */
  recurrence_rule?: RecurrenceRule | null
  /**
   * Unique key for a painted calendar occurrence.
   * Same task id may appear multiple times when showing all repeat cycles.
   */
  instance_key?: string
}

export interface CreateProjectInput {
  name: string
  color?: string
  view_mode?: ProjectViewMode
  folder_id?: string | null
}

export interface UpdateProjectInput {
  name?: string
  color?: string
  view_mode?: ProjectViewMode
  sort_order?: number
  folder_id?: string | null
}

export interface CreateFolderInput {
  name: string
}

export interface UpdateFolderInput {
  name?: string
  sort_order?: number
}

export interface TaskDetail extends Task {
  tags: string[]
  reminders: TaskReminder[]
}

export interface CreateTaskInput {
  title: string
  project_id: string
  content?: string
  priority?: Priority
  due_date?: string | null
  start_date?: string | null
  is_all_day?: boolean
  time_zone?: string | null
  parent_id?: string | null
  tags?: string[]
  recurrence_rule?: RecurrenceRule | null
  reminders?: ReminderInput[]
}

export interface UpdateTaskInput {
  title?: string
  project_id?: string
  content?: string
  priority?: Priority
  due_date?: string | null
  start_date?: string | null
  is_all_day?: boolean
  time_zone?: string | null
  parent_id?: string | null
  tags?: string[]
  recurrence_rule?: RecurrenceRule | null
  /**
   * When editing a recurring task:
   * - `this` — apply fields to this occurrence only (clears recurrence on this row)
   * - `all` — apply to this task and keep/update the series rule (default)
   */
  recurrence_edit_scope?: 'this' | 'all'
  reminders?: ReminderInput[]
}

/** Patch applied to many tasks in one bulk operation (Phase 9). */
export interface BulkTaskPatch {
  due_date?: string | null
  start_date?: string | null
  is_all_day?: boolean
  priority?: Priority
  project_id?: string
  /** Merge these tags onto each task (union). */
  add_tags?: string[]
  /** Remove these tags from each task. */
  remove_tags?: string[]
}

export interface CreateTagInput {
  name: string
  color?: string | null
}

export interface ChangeNotification {
  entityType: 'task' | 'project' | 'tag' | 'folder'
  entityId?: string
  reason: 'local' | 'sync'
}

/** Desktop sticky window state — content lives on the linked task. */
export interface StickyNote {
  id: string
  task_id: string
  window_x: number
  window_y: number
  width: number
  height: number
  is_pinned: boolean
  is_collapsed: boolean
  color: string | null
  created_at: string
  updated_at: string
}

export interface StickyBoundsPatch {
  window_x?: number
  window_y?: number
  width?: number
  height?: number
  is_collapsed?: boolean
  color?: string | null
}
