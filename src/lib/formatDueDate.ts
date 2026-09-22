import {
  addDays,
  format,
  isThisWeek,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from 'date-fns'
import type { TimeFormat } from '@/hooks/useTimeFormat'
import { getWeekStartsOn } from '@/hooks/useWeekStartsOn'

function timePattern(timeFormat: TimeFormat): string {
  return timeFormat === '24h' ? 'HH:mm' : 'h:mm a'
}

/** Today / Tomorrow / weekday (this week) / MMM d. */
function formatDayPart(day: Date): string {
  if (isToday(day)) return 'Today'
  if (isTomorrow(day)) return 'Tomorrow'
  if (isThisWeek(day, { weekStartsOn: getWeekStartsOn() })) return format(day, 'EEE')
  return format(day, 'MMM d')
}

export function formatDueDate(
  dueDate: string | null,
  isAllDay: boolean,
  timeFormat: TimeFormat = '12h',
): string | null {
  if (!dueDate) return null

  try {
    const date = parseISO(dueDate)
    // All-day chips use the local calendar day (not the raw instant clock).
    const day = isAllDay ? startOfDay(date) : date
    const dayLabel = formatDayPart(day)
    if (isAllDay) return dayLabel
    return `${dayLabel}, ${format(date, timePattern(timeFormat))}`
  } catch {
    return null
  }
}

/** True when start/due represent a real range (not the same point-in-time). */
export function isTimedDuration(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
): boolean {
  if (!startDate || !dueDate) return false
  try {
    const startMs = parseISO(startDate).getTime()
    const dueMs = parseISO(dueDate).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(dueMs)) return false
    // Same minute → point-in-time (TickTick often mirrors start into due)
    return Math.abs(startMs - dueMs) >= 60_000
  } catch {
    return false
  }
}

/** Point or duration range label for list chips and calendar. */
export function formatDueRange(
  input: {
    due_date: string | null
    start_date?: string | null
    is_all_day: boolean
  },
  timeFormat: TimeFormat = '12h',
): string | null {
  if (!input.due_date) return null
  const start = input.start_date
  if (!start || !isTimedDuration(start, input.due_date)) {
    return formatDueDate(input.due_date, input.is_all_day, timeFormat)
  }

  try {
    const startDate = parseISO(start)
    const endDate = parseISO(input.due_date)
    const sameDay =
      format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')
    const tp = timePattern(timeFormat)

    if (input.is_all_day) {
      if (sameDay) return formatDayPart(endDate)
      return `${formatDayPart(startDate)} – ${formatDayPart(endDate)}`
    }

    if (sameDay) {
      return `${format(startDate, tp)}–${format(endDate, tp)}`
    }
    return `${formatDayPart(startDate)}, ${format(startDate, tp)} – ${formatDayPart(endDate)}, ${format(endDate, tp)}`
  } catch {
    return formatDueDate(input.due_date, input.is_all_day, timeFormat)
  }
}

/** Compact label for detail panel schedule chip. */
export function formatScheduleLabel(
  input: {
    due_date: string | null
    start_date?: string | null
    is_all_day: boolean
  },
  timeFormat: TimeFormat = '12h',
): string {
  if (!input.due_date) return 'Set date'
  return formatDueRange(input, timeFormat) ?? 'Set date'
}

export function isOverdue(dueDate: string | null, isAllDay = false): boolean {
  if (!dueDate) return false
  try {
    const date = parseISO(dueDate)
    if (isAllDay) {
      // All-day is overdue only after its local calendar day has ended.
      return startOfDay(date) < startOfDay(new Date())
    }
    return date < new Date() && !isToday(date)
  } catch {
    return false
  }
}

export function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  try {
    return format(parseISO(iso), 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

/** Always 24h `HH:mm` for storage / native time values. */
export function toTimeInputValue(iso: string | null): string {
  if (!iso) return ''
  try {
    return format(parseISO(iso), 'HH:mm')
  } catch {
    return ''
  }
}

/** Build ISO from local date + optional time. All-day uses noon local. */
export function combineLocalDateTime(
  dateStr: string,
  timeStr: string | null,
  allDay: boolean,
): string | null {
  if (!dateStr) return null
  if (allDay || !timeStr) {
    return new Date(`${dateStr}T12:00:00`).toISOString()
  }
  return new Date(`${dateStr}T${timeStr}:00`).toISOString()
}

export function dateInputToIso(value: string): string | null {
  return combineLocalDateTime(value, null, true)
}

export function startOfLocalTodayIso(): string {
  return startOfDay(new Date()).toISOString()
}

export function presetDueIso(
  preset: 'today' | 'tomorrow' | 'next_week',
  allDay: boolean,
  time = '09:00',
): string {
  const base =
    preset === 'today' ? new Date() : preset === 'tomorrow' ? addDays(new Date(), 1) : addDays(new Date(), 7)
  const dateStr = format(base, 'yyyy-MM-dd')
  return combineLocalDateTime(dateStr, allDay ? null : time, allDay)!
}

/** Parse `HH:mm` into parts for a 12h UI. */
export function parseTime24(time24: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = time24.split(':')
  let hour = Number(hStr) || 0
  const minute = Number(mStr) || 0
  const period: 'AM' | 'PM' = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12
  if (hour === 0) hour = 12
  return { hour12: hour, minute, period }
}

export function toTime24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let hour = hour12 % 12
  if (period === 'PM') hour += 12
  if (period === 'AM' && hour12 === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function formatTimeLabel(time24: string, timeFormat: TimeFormat): string {
  const [hStr, mStr] = time24.split(':')
  const hour = Number(hStr) || 0
  const minute = Number(mStr) || 0
  const date = new Date(2000, 0, 1, hour, minute)
  return format(date, timePattern(timeFormat))
}

/** Half-hour slots for the whole day (`00:00` … `23:30`). */
export function halfHourTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 0; h < 24; h += 1) {
    for (const m of [0, 30]) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

/**
 * Parse free-typed time into `HH:mm`.
 * Accepts: 9, 9:30, 930, 9.30, 9pm, 9:30 AM, 21:00, etc.
 */
export function parseTypedTime(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase().replace(/\./g, ':').replace(/\s+/g, ' ')
  if (!cleaned) return null

  const am = /\b(a|am)\b/.test(cleaned) || cleaned.endsWith('a')
  const pm = /\b(p|pm)\b/.test(cleaned) || cleaned.endsWith('p')
  const digits = cleaned.replace(/[^0-9:]/g, '')

  let hour = 0
  let minute = 0

  if (/^\d{1,2}:\d{1,2}$/.test(digits)) {
    const [h, m] = digits.split(':').map(Number)
    hour = h
    minute = m
  } else if (/^\d{3,4}$/.test(digits)) {
    const padded = digits.padStart(4, '0')
    hour = Number(padded.slice(0, 2))
    minute = Number(padded.slice(2))
  } else if (/^\d{1,2}$/.test(digits)) {
    hour = Number(digits)
    minute = 0
  } else {
    return null
  }

  if (minute > 59) return null

  if (am || pm) {
    if (hour < 1 || hour > 12) return null
    if (pm && hour < 12) hour += 12
    if (am && hour === 12) hour = 0
  } else if (hour > 23) {
    return null
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

