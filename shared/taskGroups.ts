import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns'
import type { Priority, ProjectSection, TaskListItem } from './entities'
import type { TaskGroupBy } from './filters'

export interface TaskGroup {
  key: string
  label: string
  /** Ascending sort among groups; lower first. */
  sort: number
  tasks: TaskListItem[]
  /** Local section id when grouping by section (null = unsectioned). */
  sectionId?: string | null
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
): TaskGroup {
  const existing = map.get(key)
  if (existing) {
    existing.tasks.push(task)
    return existing
  }
  const created: TaskGroup = { key, label, sort, tasks: [task] }
  map.set(key, created)
  return created
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
      case 'section': {
        // Prefer groupTasksBySection when the full section list is available
        // (includes empty sections). Fallback groups only populated sections.
        if (task.section_id) {
          const group = pushGroup(
            map,
            task.section_id,
            task.section_name?.trim() || 'Untitled',
            task.section_sort ?? 0,
            task,
          )
          group.sectionId = task.section_id
        } else {
          // Legacy null section_id — treat as Not Sectioned bucket
          const group = pushGroup(
            map,
            'not-sectioned',
            'Not Sectioned',
            Number.POSITIVE_INFINITY,
            task,
          )
          group.sectionId = null
        }
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

/**
 * Group by TickTick list sections, including empty sections in sort order.
 * Default "Not Sectioned" is a real section row; orphan/null tasks join that bucket when present.
 */
export function groupTasksBySection(
  tasks: TaskListItem[],
  sections: Array<Pick<ProjectSection, 'id' | 'name' | 'sort_order' | 'is_default'>>,
): TaskGroup[] {
  if (sections.length === 0) {
    return [{ key: 'all', label: '', sort: 0, tasks, sectionId: null }]
  }

  const groups: TaskGroup[] = sections.map((section) => ({
    key: section.id,
    label: section.name.trim() || 'Untitled',
    sort: section.sort_order,
    tasks: [],
    sectionId: section.id,
  }))
  const byId = new Map(groups.map((g) => [g.key, g]))
  let defaultGroup =
    groups.find((_, i) => sections[i]?.is_default) ??
    groups.find((g) => g.label.trim().toLowerCase() === 'not sectioned') ??
    null

  const orphans: TaskListItem[] = []
  for (const task of tasks) {
    if (task.section_id && byId.has(task.section_id)) {
      byId.get(task.section_id)!.tasks.push(task)
    } else if (defaultGroup) {
      defaultGroup.tasks.push(task)
    } else {
      orphans.push(task)
    }
  }

  // Never drop tasks if default is missing from the section list yet
  if (orphans.length > 0 && !defaultGroup) {
    defaultGroup = {
      key: 'not-sectioned',
      label: 'Not Sectioned',
      sort: Number.NEGATIVE_INFINITY,
      tasks: orphans,
      sectionId: null,
    }
    groups.push(defaultGroup)
  }

  return groups.sort((a, b) => {
    if (a.sort !== b.sort) return a.sort - b.sort
    return a.label.localeCompare(b.label)
  })
}
