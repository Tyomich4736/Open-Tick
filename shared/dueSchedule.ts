import {
  addDays,
  differenceInCalendarDays,
  formatISO,
  parseISO,
  startOfDay,
} from 'date-fns'

export type DueScheduleFields = {
  due_date: string | null
  start_date?: string | null
  is_all_day: boolean
}

/**
 * Date-only "No time" clock anchors when not all-day: local noon (picker) or
 * midnight (smart-list quick-add). Explicit 12:00 / 00:00 times use :01 seconds.
 */
export function isDateOnlyAnchor(iso: string): boolean {
  try {
    const d = parseISO(iso)
    const h = d.getHours()
    return (
      (h === 12 || h === 0) && d.getMinutes() === 0 && d.getSeconds() === 0
    )
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

  // Fresh date or date-only "No time"
  return {
    due_date: formatISO(noonOn(targetDay)),
    start_date: null,
    is_all_day: false,
  }
}
