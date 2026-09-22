import type { TaskStatus } from './entities'

export type TaskSortMode = 'order' | 'due_date' | 'title' | 'priority'

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
