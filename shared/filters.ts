import type { TaskStatus } from './entities'

export type TaskSortMode = 'order' | 'due_date' | 'title' | 'priority'

/** How root tasks are sectioned in the list view. */
export type TaskGroupBy = 'none' | 'section' | 'date' | 'list' | 'tag' | 'priority'

export type SmartListId = 'inbox' | 'today' | 'tomorrow' | 'week' | 'overdue' | 'completed'

export interface TaskFilter {
  project_id?: string
  smart_list?: SmartListId
  status?: TaskStatus
  tag?: string
  search?: string
  parent_id?: string | null
  /** Manual / due / title / priority. Completed list always uses completed_at. */
  sort?: TaskSortMode
  /** When false, exclude completed tasks (project/inbox). Smart lists ignore this. */
  include_completed?: boolean
  /** Inclusive ISO range for calendar queries (duration-aware overlap). */
  due_from?: string
  due_to?: string
  /**
   * With due_from/due_to: also include pending tasks that have a recurrence rule
   * (even if their current occurrence is outside the range) so the calendar can
   * expand future cycles.
   */
  include_recurring_series?: boolean
}

export const TASK_SORT_OPTIONS: { value: TaskSortMode; label: string }[] = [
  { value: 'order', label: 'Custom' },
  { value: 'due_date', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
]

export const TASK_GROUP_BY_OPTIONS: { value: TaskGroupBy; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'section', label: 'Section' },
  { value: 'date', label: 'Date' },
  { value: 'list', label: 'List' },
  { value: 'tag', label: 'Tag' },
  { value: 'priority', label: 'Priority' },
]

export function defaultSortForView(smartList?: SmartListId | null): TaskSortMode {
  if (!smartList) return 'order'
  switch (smartList) {
    case 'today':
    case 'tomorrow':
    case 'week':
    case 'overdue':
      return 'due_date'
    case 'completed':
      return 'order' // UI hides picker; repo forces completed_at
    default:
      return 'order'
  }
}

export function listSortSettingKey(scope: string): string {
  return `list_sort.${scope}`
}

export function listShowCompletedSettingKey(scope: string): string {
  return `list_show_completed.${scope}`
}

export function listGroupBySettingKey(scope: string): string {
  return `list_group_by.${scope}`
}

/** Collapsed group keys for a view + group-by mode (missing key = expanded). */
export function listGroupCollapsedSettingKey(scope: string, groupBy: TaskGroupBy): string {
  return `list_group_collapsed.${scope}.${groupBy}`
}

export function defaultGroupByForView(viewKind?: 'smart' | 'project' | 'tag'): TaskGroupBy {
  // TickTick list view: project lists default to custom sections.
  if (viewKind === 'project') return 'section'
  return 'none'
}

/** Group-by modes available for this view (list only inside smart lists; section on projects). */
export function groupByOptionsForView(viewKind: 'smart' | 'project' | 'tag'): typeof TASK_GROUP_BY_OPTIONS {
  if (viewKind === 'smart') {
    return TASK_GROUP_BY_OPTIONS.filter((opt) => opt.value !== 'section')
  }
  if (viewKind === 'tag') {
    return TASK_GROUP_BY_OPTIONS.filter((opt) => opt.value !== 'list' && opt.value !== 'section')
  }
  return TASK_GROUP_BY_OPTIONS.filter((opt) => opt.value !== 'list')
}

export function viewSortScope(
  view:
    | { kind: 'smart'; smart_list: SmartListId }
    | { kind: 'project'; projectId: string }
    | { kind: 'tag'; tagName: string },
): string {
  if (view.kind === 'smart') return `smart.${view.smart_list}`
  if (view.kind === 'tag') return `tag.${view.tagName}`
  return `project.${view.projectId}`
}
