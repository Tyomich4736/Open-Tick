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
 * Context-menu Today / Tomorrow / Next week / Clear.
 * Moves the due calendar day but keeps the original clock time (and shifts start
 * by the same day delta when present). All-day tasks stay all-day.
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

  if (current.due_date && !current.is_all_day) {
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

  // No date yet, or already all-day → all-day on the target day
  let nextStart: string | null = null
  if (current.start_date && current.due_date && current.is_all_day) {
    const prevStart = parseISO(current.start_date)
    const prevDue = parseISO(current.due_date)
    const dueDelta = differenceInCalendarDays(targetDay, startOfDay(prevDue))
    nextStart = formatISO(addDays(startOfDay(prevStart), dueDelta))
  }

  return {
    due_date: formatISO(targetDay),
    start_date: nextStart,
    is_all_day: true,
  }
}
