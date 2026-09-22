import { useCallback, useEffect, useState } from 'react'
import {
  detectSystemTimezone,
  resolveTimezone,
  SYSTEM_TIMEZONE,
} from '@shared/timezone'
import { ipc } from '@/lib/ipc-client'

export const TIMEZONE_SETTING_KEY = 'timezone'
export { SYSTEM_TIMEZONE, detectSystemTimezone, resolveTimezone }

let cachedSetting = SYSTEM_TIMEZONE
let loaded = false
const listeners = new Set<(tz: string) => void>()

function notify(next: string) {
  cachedSetting = next
  for (const listener of listeners) listener(next)
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return
  loaded = true
  const result = await ipc.settings.get<string>(TIMEZONE_SETTING_KEY)
  if (result.ok && typeof result.data === 'string' && result.data.length > 0) {
    notify(result.data)
  } else {
    notify(SYSTEM_TIMEZONE)
  }
}

export function useTimezone() {
  const [timezoneSetting, setState] = useState(cachedSetting)

  useEffect(() => {
    listeners.add(setState)
    void ensureLoaded()
    return () => {
      listeners.delete(setState)
    }
  }, [])

  const setTimezone = useCallback((next: string) => {
    notify(next)
    void ipc.settings.set(TIMEZONE_SETTING_KEY, next)
  }, [])

  return {
    /** Stored preference: `system` or an IANA id. */
    timezoneSetting,
    /** Resolved IANA zone for display / date math. */
    timezone: resolveTimezone(timezoneSetting),
    systemTimezone: detectSystemTimezone(),
    setTimezone,
  }
}

export function listTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return [detectSystemTimezone(), 'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo']
  }
}
