import { parseISO } from 'date-fns'
import type { TaskListItem } from './entities'
import type { RecurrenceRule } from './recurrence'
import { nextOccurrenceDates } from './nextOccurrence'

const MAX_OCCURRENCES = 400

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  try {
    const d = parseISO(iso)
    return Number.isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

function occurrenceOverlapsRange(
  startIso: string | null,
  dueIso: string | null,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const start = parseDate(startIso ?? dueIso)
  const end = parseDate(dueIso)
  if (!start || !end) return false
  return start <= rangeEnd && end >= rangeStart
}

function instanceKey(taskId: string, due: string | null, start: string | null): string {
  return `${taskId}::${due ?? start ?? 'undated'}`
}

/**
 * Expand recurring tasks into virtual calendar instances within [rangeStart, rangeEnd].
 * Non-recurring tasks that overlap the range are passed through unchanged.
 * Virtual instances keep the real task `id` (for open/detail) and set `instance_key`.
 */
export function expandTasksForCalendarRange(
  tasks: TaskListItem[],
  rangeStart: Date,
  rangeEnd: Date,
): TaskListItem[] {
  const out: TaskListItem[] = []
  const seen = new Set<string>()

  const push = (task: TaskListItem, key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push({ ...task, instance_key: key })
  }

  for (const task of tasks) {
    const rule = task.recurrence_rule ?? null
    if (!rule) {
      if (occurrenceOverlapsRange(task.start_date, task.due_date, rangeStart, rangeEnd)) {
        push(task, task.instance_key ?? task.id)
      }
      continue
    }

    expandSeries(task, rule, rangeStart, rangeEnd, push)
  }

  return out
}

function expandSeries(
  task: TaskListItem,
  rule: RecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date,
  push: (task: TaskListItem, key: string) => void,
): void {
  let due = task.due_date
  let start = task.start_date
  let currentRule = rule
  let guard = 0

  while (guard++ < MAX_OCCURRENCES) {
    const end = parseDate(due) ?? parseDate(start)

    // Still before the visible window — advance without painting.
    if (end && end < rangeStart) {
      const next = nextOccurrenceDates(currentRule, {
        due_date: due,
        start_date: start,
      })
      if (!next) break
      if (next.due_date === due && next.start_date === start) break
      due = next.due_date
      start = next.start_date
      currentRule = next.rule
      continue
    }

    if (occurrenceOverlapsRange(start, due, rangeStart, rangeEnd)) {
      push(
        {
          ...task,
          due_date: due,
          start_date: start,
          recurrence_rule: currentRule,
        },
        instanceKey(task.id, due, start),
      )
    }

    if (end && end > rangeEnd) break

    const next = nextOccurrenceDates(currentRule, {
      due_date: due,
      start_date: start,
    })
    if (!next) break

    // Avoid infinite loops if dates don't advance
    if (next.due_date === due && next.start_date === start) break

    due = next.due_date
    start = next.start_date
    currentRule = next.rule
  }
}
