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

function snapToWeekday(date: Date, weekdays: number[]): Date {
  if (!weekdays.length) return date
  let candidate = date
  for (let i = 0; i < 7; i++) {
    if (weekdays.includes(candidate.getDay())) return candidate
    candidate = addDays(candidate, 1)
  }
  return date
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

  let nextDue = advanceByFrequency(parseISO(anchorIso), rule)
  if (rule.frequency === 'weekly' && rule.weekdays && rule.weekdays.length > 0) {
    nextDue = snapToWeekday(nextDue, rule.weekdays)
  }

  if (rule.end.type === 'on_date' && isAfter(nextDue, parseISO(rule.end.date))) {
    return null
  }

  let nextStart: string | null = null
  if (current.start_date && current.due_date) {
    const span = parseISO(current.due_date).getTime() - parseISO(current.start_date).getTime()
    nextStart = new Date(nextDue.getTime() - span).toISOString()
  } else if (current.start_date && !current.due_date) {
    nextStart = advanceByFrequency(parseISO(current.start_date), rule).toISOString()
  }

  const due_date =
    current.due_date != null || current.start_date == null ? nextDue.toISOString() : null

  return {
    due_date,
    start_date: nextStart,
    rule: { ...rule, completed_count: completedCount },
  }
}
