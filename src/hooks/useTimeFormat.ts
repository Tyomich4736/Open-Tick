import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc-client'

export type TimeFormat = '12h' | '24h'

export const TIME_FORMAT_SETTING_KEY = 'time_format'
export const DEFAULT_TIME_FORMAT: TimeFormat = '12h'

let cachedFormat: TimeFormat = DEFAULT_TIME_FORMAT
let loaded = false
const listeners = new Set<(format: TimeFormat) => void>()

function notify(format: TimeFormat) {
  cachedFormat = format
  for (const listener of listeners) listener(format)
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const result = await ipc.settings.get<TimeFormat>(TIME_FORMAT_SETTING_KEY)
  if (result.ok && (result.data === '12h' || result.data === '24h')) {
    notify(result.data)
  }
}

export function useTimeFormat() {
  const [timeFormat, setTimeFormatState] = useState<TimeFormat>(cachedFormat)

  useEffect(() => {
    listeners.add(setTimeFormatState)
    void ensureLoaded()
    return () => {
      listeners.delete(setTimeFormatState)
    }
  }, [])

  const setTimeFormat = useCallback((next: TimeFormat) => {
    notify(next)
    void ipc.settings.set(TIME_FORMAT_SETTING_KEY, next)
  }, [])

  return { timeFormat, setTimeFormat }
}
