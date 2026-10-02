import { addDays, addMonths, addWeeks, addYears, isAfter, parseISO } from 'date-fns'
import type { RecurrenceRule } from './recurrence'

function advanceByFrequency(date: Date, rule: RecurrenceRule): Date {
  const interval = Math.max(1, rule.interval || 1)
  switch (rule.frequency) {
    case 'daily':
      return addDays(date, interval)
    case 'weekly':
      return addWeeks(date, interval)
    case 'monthly':
      return addMonths(date, interval)
    case 'yearly':
      return addYears(date, interval)
    default:
      return addDays(date, interval)
  }
}

/** Next weekly due: later weekday in the same week, else first weekday `interval` weeks ahead. */
function advanceWeekly(date: Date, rule: RecurrenceRule): Date {
  const interval = Math.max(1, rule.interval || 1)
  const weekdays =
    rule.weekdays && rule.weekdays.length > 0
      ? [...rule.weekdays].sort((a, b) => a - b)
      : [date.getDay()]
  const day = date.getDay()

  for (const wd of weekdays) {
    if (wd > day) return addDays(date, wd - day)
  }

  const first = weekdays[0]
  const daysIntoNextCycle = 7 - day + first + 7 * (interval - 1)
  return addDays(date, daysIntoNextCycle)
}

/**
 * Compute the next occurrence dates after completing a recurring task.
 * Returns null if the series has ended.
 */
export function nextOccurrenceDates(
  rule: RecurrenceRule,
  current: { due_date: string | null; start_date: string | null; completed_at?: string | null },
): { due_date: string | null; start_date: string | null; rule: RecurrenceRule } | null {
  const completedCount = (rule.completed_count ?? 0) + 1
  if (rule.end.type === 'after_count' && completedCount >= rule.end.count) {
    return null
  }

  const anchorIso =
    rule.anchor === 'completion'
      ? (current.completed_at ?? current.due_date ?? new Date().toISOString())
      : (current.due_date ?? current.start_date ?? new Date().toISOString())

  const anchor = parseISO(anchorIso)
  const nextDue =
    rule.frequency === 'weekly' ? advanceWeekly(anchor, rule) : advanceByFrequency(anchor, rule)

  if (rule.end.type === 'on_date' && isAfter(nextDue, parseISO(rule.end.date))) {
    return null
  }

  let nextStart: string | null = null
  if (current.start_date && current.due_date) {
    const span = parseISO(current.due_date).getTime() - parseISO(current.start_date).getTime()
    nextStart = new Date(nextDue.getTime() - span).toISOString()
  } else if (current.start_date && !current.due_date) {
    nextStart =
      rule.frequency === 'weekly'
        ? advanceWeekly(parseISO(current.start_date), rule).toISOString()
        : advanceByFrequency(parseISO(current.start_date), rule).toISOString()
  }

  const due_date =
    current.due_date != null || current.start_date == null ? nextDue.toISOString() : null

  return {
    due_date,
    start_date: nextStart,
    rule: { ...rule, completed_count: completedCount },
  }
}
