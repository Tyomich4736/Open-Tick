import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc-client'

/** Hour of day when the calendar timed grid starts (0–23). */
export const CALENDAR_DAY_START_HOUR_KEY = 'calendar_day_start_hour'
/** Hour of day when the calendar timed grid ends (1–24, exclusive end of last slot). */
export const CALENDAR_DAY_END_HOUR_KEY = 'calendar_day_end_hour'

export const DEFAULT_DAY_START_HOUR = 0
export const DEFAULT_DAY_END_HOUR = 24

export interface CalendarVisibleHours {
  startHour: number
  endHour: number
}

let cached: CalendarVisibleHours = {
  startHour: DEFAULT_DAY_START_HOUR,
  endHour: DEFAULT_DAY_END_HOUR,
}
let loaded = false
const listeners = new Set<(v: CalendarVisibleHours) => void>()

function notify(next: CalendarVisibleHours) {
  cached = next
  for (const listener of listeners) listener(next)
}

function clampHour(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function normalize(startHour: number, endHour: number): CalendarVisibleHours {
  let start = clampHour(startHour, 0, 23, DEFAULT_DAY_START_HOUR)
  let end = clampHour(endHour, 1, 24, DEFAULT_DAY_END_HOUR)
  if (end <= start) end = Math.min(24, start + 1)
  return { startHour: start, endHour: end }
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const [startRes, endRes] = await Promise.all([
    ipc.settings.get<unknown>(CALENDAR_DAY_START_HOUR_KEY),
    ipc.settings.get<unknown>(CALENDAR_DAY_END_HOUR_KEY),
  ])
  const startHour = startRes.ok
    ? clampHour(startRes.data, 0, 23, DEFAULT_DAY_START_HOUR)
    : DEFAULT_DAY_START_HOUR
  const endHour = endRes.ok
    ? clampHour(endRes.data, 1, 24, DEFAULT_DAY_END_HOUR)
    : DEFAULT_DAY_END_HOUR
  notify(normalize(startHour, endHour))
}

export function useCalendarVisibleHours() {
  const [hours, setHours] = useState<CalendarVisibleHours>(cached)

  useEffect(() => {
    listeners.add(setHours)
    void ensureLoaded()
    return () => {
      listeners.delete(setHours)
    }
  }, [])

  const setStartHour = useCallback((startHour: number) => {
    const prev = cached
    const next = normalize(startHour, prev.endHour)
    notify(next)
    void ipc.settings.set(CALENDAR_DAY_START_HOUR_KEY, next.startHour)
    if (next.endHour !== prev.endHour) {
      void ipc.settings.set(CALENDAR_DAY_END_HOUR_KEY, next.endHour)
    }
  }, [])

  const setEndHour = useCallback((endHour: number) => {
    const prev = cached
    const next = normalize(prev.startHour, endHour)
    notify(next)
    void ipc.settings.set(CALENDAR_DAY_END_HOUR_KEY, next.endHour)
    if (next.startHour !== prev.startHour) {
      void ipc.settings.set(CALENDAR_DAY_START_HOUR_KEY, next.startHour)
    }
  }, [])

  const setVisibleHours = useCallback((startHour: number, endHour: number) => {
    const next = normalize(startHour, endHour)
    notify(next)
    void ipc.settings.set(CALENDAR_DAY_START_HOUR_KEY, next.startHour)
    void ipc.settings.set(CALENDAR_DAY_END_HOUR_KEY, next.endHour)
  }, [])

  return {
    startHour: hours.startHour,
    endHour: hours.endHour,
    setStartHour,
    setEndHour,
    setVisibleHours,
  }
}

/** Options for hour selects: 0–23 labeled as times. */
export function hourOptions(from: number, to: number): number[] {
  const out: number[] = []
  for (let h = from; h <= to; h += 1) out.push(h)
  return out
}
