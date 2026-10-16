import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { TaskListItem } from '@shared/entities'

export type WeekStartsOn = 0 | 1

export function effectiveStart(task: Pick<TaskListItem, 'start_date' | 'due_date'>): Date | null {
  const iso = task.start_date ?? task.due_date
  if (!iso) return null
  try {
    return parseISO(iso)
  } catch {
    return null
  }
}

export function effectiveEnd(task: Pick<TaskListItem, 'due_date'>): Date | null {
  if (!task.due_date) return null
  try {
    return parseISO(task.due_date)
  } catch {
    return null
  }
}

/** Task overlaps local calendar day (midnight–midnight). */
export function taskOverlapsDay(
  task: Pick<TaskListItem, 'start_date' | 'due_date'>,
  day: Date,
): boolean {
  const start = effectiveStart(task)
  const end = effectiveEnd(task)
  if (!start || !end) return false
  const dayStart = startOfDay(day)
  const dayEnd = endOfDay(day)
  return start <= dayEnd && end >= dayStart
}

export function tasksForDay(tasks: TaskListItem[], day: Date): TaskListItem[] {
  return tasks.filter((t) => taskOverlapsDay(t, day))
}

export function monthGridRange(cursor: Date, weekStartsOn: WeekStartsOn): { start: Date; end: Date } {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn })
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn })
  return { start, end }
}

export function weekRange(cursor: Date, weekStartsOn: WeekStartsOn): { start: Date; end: Date } {
  return {
    start: startOfWeek(cursor, { weekStartsOn }),
    end: endOfWeek(cursor, { weekStartsOn }),
  }
}

export function dayRange(cursor: Date): { start: Date; end: Date } {
  return { start: startOfDay(cursor), end: endOfDay(cursor) }
}

/** N consecutive days starting at cursor (inclusive). `count` typically 2–6. */
export function multiDayRange(cursor: Date, count: number): { start: Date; end: Date } {
  const n = Math.max(1, Math.floor(count))
  const start = startOfDay(cursor)
  return { start, end: endOfDay(addDays(start, n - 1)) }
}

export function agendaRange(cursor: Date, days = 30): { start: Date; end: Date } {
  const start = startOfDay(cursor)
  return { start, end: endOfDay(addDays(start, days - 1)) }
}

/** Inclusive ISO bounds for TaskFilter due_from / due_to (local calendar days). */
export function rangeToFilterIso(start: Date, end: Date): { due_from: string; due_to: string } {
  return {
    due_from: startOfDay(start).toISOString(),
    due_to: endOfDay(end).toISOString(),
  }
}

/** Local wall-clock ISO for a day + `HH:mm` (or noon if all-day). */
export function localSlotIso(day: Date, time24: string | null, allDay: boolean): string {
  const dateStr = format(day, 'yyyy-MM-dd')
  if (allDay || !time24) {
    return new Date(`${dateStr}T12:00:00`).toISOString()
  }
  return new Date(`${dateStr}T${time24}:00`).toISOString()
}

export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

export function snapMinutes(mins: number, step = 30): number {
  return Math.round(mins / step) * step
}

export function formatHourLabel(hour: number, timeFormat: '12h' | '24h'): string {
  const d = new Date(2000, 0, 1, hour, 0)
  return format(d, timeFormat === '24h' ? 'HH:mm' : 'h a')
}

export const HOUR_HEIGHT_PX = 48

export interface TimedLayoutItem {
  task: TaskListItem
  startMin: number
  endMin: number
  /** 0-based column within the overlap cluster */
  col: number
  /** Total columns in this overlap cluster */
  colCount: number
}

/**
 * Pack timed events into non-overlapping columns (Google Calendar style).
 * Events that share time get side-by-side slots within their cluster.
 */
export function layoutTimedEvents(
  items: { task: TaskListItem; startMin: number; endMin: number }[],
): TimedLayoutItem[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin
    return b.endMin - b.startMin - (a.endMin - a.startMin)
  })

  // Assign column: first free lane whose last end <= this start
  const colEnds: number[] = []
  const withCol: (typeof sorted[0] & { col: number })[] = sorted.map((item) => {
    let col = colEnds.findIndex((end) => end <= item.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(item.endMin)
    } else {
      colEnds[col] = item.endMin
    }
    return { ...item, col }
  })

  // Cluster by overlapping groups; each cluster shares one colCount
  const result: TimedLayoutItem[] = []
  let cluster: typeof withCol = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const colCount = Math.max(...cluster.map((c) => c.col)) + 1
    for (const c of cluster) {
      result.push({
        task: c.task,
        startMin: c.startMin,
        endMin: c.endMin,
        col: c.col,
        colCount,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const item of withCol) {
    if (cluster.length === 0 || item.startMin < clusterEnd) {
      cluster.push(item)
      clusterEnd = Math.max(clusterEnd, item.endMin)
    } else {
      flush()
      cluster.push(item)
      clusterEnd = item.endMin
    }
  }
  flush()

  return result
}

/** Parse store cursor `yyyy-MM-dd` to local Date at noon. */
export function parseCursorDate(cursorDate: string): Date {
  try {
    return parseISO(`${cursorDate}T12:00:00`)
  } catch {
    return new Date()
  }
}
