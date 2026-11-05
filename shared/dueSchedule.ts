import {
  addDays,
  compareAsc,
  differenceInCalendarDays,
  formatISO,
  parseISO,
  startOfDay,
} from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export type DueScheduleFields = {
  due_date: string | null
  start_date?: string | null
  is_all_day: boolean
}

/**
 * Date-only "No time" storage: local midnight (no clock). Legacy rows may still
 * use noon; treat both as date-only when minutes/seconds are zero.
 */
export function isDateOnlyAnchor(iso: string): boolean {
  try {
    const d = parseISO(iso)
    const h = d.getHours()
    return (h === 0 || h === 12) && d.getMinutes() === 0 && d.getSeconds() === 0
  } catch {
    return false
  }
}

/**
 * Time-tab "No time": due date without a clock, not a TickTick all-day event.
 * Legacy rows used `is_all_day` + no start for the same meaning.
 */
export function isDateOnlySchedule(input: DueScheduleFields): boolean {
  if (!input.due_date || input.start_date) return false
  if (input.is_all_day) return true
  return isDateOnlyAnchor(input.due_date)
}

/** Duration-tab "All day" — TickTick all-day event with start + due. */
export function isAllDayEvent(input: DueScheduleFields): boolean {
  return Boolean(input.is_all_day && input.start_date && input.due_date)
}

function noonOn(day: Date): Date {
  const next = new Date(day)
  next.setHours(12, 0, 0, 0)
  return next
}

function startOfCalendarDay(instant: Date, timeZone?: string): Date {
  if (!timeZone) return startOfDay(instant)
  const dateStr = formatInTimeZone(instant, timeZone, 'yyyy-MM-dd')
  return fromZonedTime(`${dateStr}T00:00:00.000`, timeZone)
}

/**
 * Instant used for due-date ordering.
 * Date-only / all-day → start of that calendar day (before timed tasks).
 * Timed point → due; timed duration → start.
 */
export function dueSortAnchor(
  input: DueScheduleFields,
  timeZone?: string,
): Date | null {
  if (!input.due_date) return null
  const iso = input.start_date || input.due_date
  try {
    const instant = parseISO(iso!)
    if (input.is_all_day || isDateOnlySchedule(input)) {
      return startOfCalendarDay(instant, timeZone)
    }
    return instant
  } catch {
    return null
  }
}

/**
 * TickTick-like due ordering: dated before undated, overdue days first,
 * then by day, date-only/all-day before timed that day, then clock time.
 */
export function compareByDueDate(
  a: DueScheduleFields & { sort_order?: number },
  b: DueScheduleFields & { sort_order?: number },
  now = new Date(),
  timeZone?: string,
): number {
  const aAnchor = dueSortAnchor(a, timeZone)
  const bAnchor = dueSortAnchor(b, timeZone)
  if (!aAnchor && !bAnchor) return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  if (!aAnchor) return 1
  if (!bAnchor) return -1

  const today = startOfCalendarDay(now, timeZone)
  const aDay = startOfCalendarDay(aAnchor, timeZone)
  const bDay = startOfCalendarDay(bAnchor, timeZone)
  const aOverdue = aDay < today
  const bOverdue = bDay < today
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

  const byDay = compareAsc(aDay, bDay)
  if (byDay !== 0) return byDay

  const aAllDayLike = a.is_all_day || isDateOnlySchedule(a)
  const bAllDayLike = b.is_all_day || isDateOnlySchedule(b)
  if (aAllDayLike !== bAllDayLike) return aAllDayLike ? -1 : 1

  const byTime = compareAsc(aAnchor, bAnchor)
  if (byTime !== 0) return byTime
  return (a.sort_order ?? 0) - (b.sort_order ?? 0)
}

/**
 * Context-menu Today / Tomorrow / Next week / Clear.
 * Moves the due calendar day but keeps the original clock time (and shifts start
 * by the same day delta when present). All-day events stay all-day; bare dates
 * stay date-only ("No time"), not TickTick all-day.
 */
export function applyDueDaysFromNow(
  current: DueScheduleFields,
  daysFromNow: number | null,
): {
  due_date: string | null
  start_date: string | null
  is_all_day: boolean
} {
  if (daysFromNow === null) {
    return { due_date: null, start_date: null, is_all_day: current.is_all_day }
  }

  const targetDay = addDays(startOfDay(new Date()), daysFromNow)

  // Timed point or timed duration — keep clock time
  if (current.due_date && !current.is_all_day && !isDateOnlySchedule(current)) {
    const prevDue = parseISO(current.due_date)
    const nextDue = new Date(targetDay)
    nextDue.setHours(
      prevDue.getHours(),
      prevDue.getMinutes(),
      prevDue.getSeconds(),
      prevDue.getMilliseconds(),
    )

    let nextStart: string | null = current.start_date ?? null
    if (current.start_date) {
      const prevStart = parseISO(current.start_date)
      const dueDelta = differenceInCalendarDays(targetDay, startOfDay(prevDue))
      nextStart = formatISO(addDays(prevStart, dueDelta))
    }

    return {
      due_date: formatISO(nextDue),
      start_date: nextStart,
      is_all_day: false,
    }
  }

  // All-day event (has start) — shift the span
  if (current.start_date && current.due_date && current.is_all_day) {
    const prevStart = parseISO(current.start_date)
    const prevDue = parseISO(current.due_date)
    const dueDelta = differenceInCalendarDays(targetDay, startOfDay(prevDue))
    return {
      due_date: formatISO(noonOn(targetDay)),
      start_date: formatISO(noonOn(addDays(startOfDay(prevStart), dueDelta))),
      is_all_day: true,
    }
  }

  // Fresh date or date-only "No time" — midnight, no clock
  return {
    due_date: formatISO(targetDay),
    start_date: null,
    is_all_day: false,
  }
}
