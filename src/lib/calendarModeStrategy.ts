import {
  addDays,
  addMonths,
  addWeeks,
  format,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import type { WeekStartsOn } from '@/lib/calendarUtils'
import {
  agendaRange,
  dayRange,
  monthGridRange,
  multiDayRange,
  rangeToFilterIso,
  weekRange,
} from '@/lib/calendarUtils'
import type { CalendarMode } from '@/stores/calendarStore'

export function filterRangeForMode(
  mode: CalendarMode,
  cursor: Date,
  weekStartsOn: WeekStartsOn,
  daysCount: number,
) {
  if (mode === 'month') {
    const { start, end } = monthGridRange(cursor, weekStartsOn)
    return { ...rangeToFilterIso(start, end), start, end }
  }
  if (mode === 'week') {
    const { start, end } = weekRange(cursor, weekStartsOn)
    return { ...rangeToFilterIso(start, end), start, end }
  }
  if (mode === 'days') {
    const { start, end } = multiDayRange(cursor, daysCount)
    return { ...rangeToFilterIso(start, end), start, end }
  }
  if (mode === 'day') {
    const { start, end } = dayRange(cursor)
    return { ...rangeToFilterIso(start, end), start, end }
  }
  const { start, end } = agendaRange(cursor, 30)
  return { ...rangeToFilterIso(start, end), start, end }
}

export function titleForMode(
  mode: CalendarMode,
  cursor: Date,
  weekStartsOn: WeekStartsOn,
  daysCount: number,
): string {
  if (mode === 'month') return format(cursor, 'MMMM yyyy')
  if (mode === 'week') {
    const { start, end } = weekRange(cursor, weekStartsOn)
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  if (mode === 'days') {
    const { start, end } = multiDayRange(cursor, daysCount)
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  if (mode === 'day') return format(cursor, 'EEEE, MMMM d, yyyy')
  return 'Agenda'
}

export function shiftCursor(
  mode: CalendarMode,
  cursor: Date,
  daysCount: number,
  direction: -1 | 1,
): Date {
  const step = direction
  if (mode === 'month') {
    return step < 0 ? subMonths(cursor, 1) : addMonths(cursor, 1)
  }
  if (mode === 'week') {
    return step < 0 ? subWeeks(cursor, 1) : addWeeks(cursor, 1)
  }
  if (mode === 'days') {
    return step < 0 ? subDays(cursor, daysCount) : addDays(cursor, daysCount)
  }
  if (mode === 'day') {
    return step < 0 ? subDays(cursor, 1) : addDays(cursor, 1)
  }
  return step < 0 ? subDays(cursor, 7) : addDays(cursor, 7)
}
