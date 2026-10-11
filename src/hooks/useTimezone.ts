import {
  detectSystemTimezone,
  resolveTimezone,
  SYSTEM_TIMEZONE,
} from '@shared/timezone'
import { createPersistedSettingHook } from '@/hooks/createPersistedSettingHook'

export const TIMEZONE_SETTING_KEY = 'timezone'
export { SYSTEM_TIMEZONE, detectSystemTimezone, resolveTimezone }

function parseTimezone(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  return null
}

const setting = createPersistedSettingHook<string>({
  key: TIMEZONE_SETTING_KEY,
  defaultValue: SYSTEM_TIMEZONE,
  parse: parseTimezone,
})

export function useTimezone() {
  const [timezoneSetting, setTimezone] = setting.useSetting()
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
