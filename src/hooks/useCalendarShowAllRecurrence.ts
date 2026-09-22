import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc-client'

/** When true, calendar paints every future cycle of recurring tasks in the visible range. */
export const CALENDAR_SHOW_ALL_RECURRENCE_KEY = 'calendar_show_all_recurrence'
export const DEFAULT_SHOW_ALL_RECURRENCE = false

let cached = DEFAULT_SHOW_ALL_RECURRENCE
let loaded = false
const listeners = new Set<(v: boolean) => void>()

function notify(next: boolean) {
  cached = next
  for (const listener of listeners) listener(next)
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return null
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const result = await ipc.settings.get<unknown>(CALENDAR_SHOW_ALL_RECURRENCE_KEY)
  if (result.ok) {
    const parsed = parseBool(result.data)
    if (parsed != null) notify(parsed)
  }
}

export function useCalendarShowAllRecurrence() {
  const [showAllRecurrence, setState] = useState(cached)

  useEffect(() => {
    listeners.add(setState)
    void ensureLoaded()
    return () => {
      listeners.delete(setState)
    }
  }, [])

  const setShowAllRecurrence = useCallback((next: boolean) => {
    notify(next)
    void ipc.settings.set(CALENDAR_SHOW_ALL_RECURRENCE_KEY, next)
  }, [])

  return { showAllRecurrence, setShowAllRecurrence }
}
