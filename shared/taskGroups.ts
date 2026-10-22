import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns'
import type { Priority, TaskListItem } from './entities'
import type { TaskGroupBy } from './filters'

export interface TaskGroup {
  key: string
  label: string
  /** Ascending sort among groups; lower first. */
  sort: number
  tasks: TaskListItem[]
}

const PRIORITY_ORDER: Priority[] = [5, 3, 1, 0]

const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'None',
  1: 'Low',
  3: 'Medium',
  5: 'High',
}

function dayKeyAndLabel(iso: string | null): { key: string; label: string; sort: number } {
  if (!iso) {
    return { key: 'no-date', label: 'No date', sort: Number.POSITIVE_INFINITY }
  }
  try {
    const date = parseISO(iso)
    if (!Number.isFinite(date.getTime())) {
      return { key: 'no-date', label: 'No date', sort: Number.POSITIVE_INFINITY }
    }
    const day = startOfDay(date)
    const key = format(day, 'yyyy-MM-dd')
    let label: string
    if (isToday(day)) label = 'Today'
    else if (isTomorrow(day)) label = 'Tomorrow'
    else if (isYesterday(day)) label = 'Yesterday'
    else label = format(day, 'EEE, MMM d')
    return { key, label, sort: day.getTime() }
  } catch {
    return { key: 'no-date', label: 'No date', sort: Number.POSITIVE_INFINITY }
  }
}

function pushGroup(
  map: Map<string, TaskGroup>,
  key: string,
  label: string,
  sort: number,
  task: TaskListItem,
): void {
  const existing = map.get(key)
  if (existing) {
    existing.tasks.push(task)
    return
  }
  map.set(key, { key, label, sort, tasks: [task] })
}

/**
 * Partition root tasks into labeled sections.
 * Multi-tag tasks use their alphabetically first tag (avoids duplicate rows).
 * Subtasks stay nested under their parent via TaskList — only roots are passed here.
 */
export function groupTasks(tasks: TaskListItem[], groupBy: TaskGroupBy): TaskGroup[] {
  if (groupBy === 'none' || tasks.length === 0) {
    return [{ key: 'all', label: '', sort: 0, tasks }]
  }

  const map = new Map<string, TaskGroup>()

  for (const task of tasks) {
    switch (groupBy) {
      case 'date': {
        const { key, label, sort } = dayKeyAndLabel(task.due_date)
        pushGroup(map, key, label, sort, task)
        break
      }
      case 'list': {
        const key = task.project_id
        const label = task.project_is_inbox ? 'Inbox' : task.project_name || 'List'
        pushGroup(map, key, label, task.project_is_inbox ? -1 : 0, task)
        break
      }
      case 'tag': {
        if (!task.tags.length) {
          pushGroup(map, 'no-tag', 'No tags', Number.POSITIVE_INFINITY, task)
        } else {
          const tag = [...task.tags].sort((a, b) => a.localeCompare(b))[0]
          pushGroup(map, `tag:${tag}`, `#${tag}`, 0, task)
        }
        break
      }
      case 'priority': {
        const priority = task.priority
        const index = PRIORITY_ORDER.indexOf(priority)
        pushGroup(
          map,
          `priority:${priority}`,
          PRIORITY_LABELS[priority],
          index >= 0 ? index : PRIORITY_ORDER.length,
          task,
        )
        break
      }
      default:
        pushGroup(map, 'all', '', 0, task)
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort
    return a.label.localeCompare(b.label)
  })
}
