import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc-client'
import type { WeekStartsOn } from '@/lib/calendarUtils'

export const WEEK_STARTS_ON_KEY = 'week_starts_on'
export const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = 1

let cached: WeekStartsOn = DEFAULT_WEEK_STARTS_ON
let loaded = false
const listeners = new Set<(v: WeekStartsOn) => void>()

/** Sync snapshot for pure formatters (updated when settings load / change). */
export function getWeekStartsOn(): WeekStartsOn {
  return cached
}

function notify(next: WeekStartsOn) {
  cached = next
  for (const listener of listeners) listener(next)
}

function parseWeekStarts(value: unknown): WeekStartsOn | null {
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  return null
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const result = await ipc.settings.get<unknown>(WEEK_STARTS_ON_KEY)
  if (result.ok) {
    const parsed = parseWeekStarts(result.data)
    if (parsed != null) notify(parsed)
  }
}

export function useWeekStartsOn() {
  const [weekStartsOn, setState] = useState<WeekStartsOn>(cached)

  useEffect(() => {
    listeners.add(setState)
    void ensureLoaded()
    return () => {
      listeners.delete(setState)
    }
  }, [])

  const setWeekStartsOn = useCallback((next: WeekStartsOn) => {
    notify(next)
    void ipc.settings.set(WEEK_STARTS_ON_KEY, next)
  }, [])

  return { weekStartsOn, setWeekStartsOn }
}
