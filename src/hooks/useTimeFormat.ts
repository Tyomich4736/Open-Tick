import { createPersistedSettingHook } from '@/hooks/createPersistedSettingHook'

export type TimeFormat = '12h' | '24h'

export const TIME_FORMAT_SETTING_KEY = 'time_format'
export const DEFAULT_TIME_FORMAT: TimeFormat = '12h'

function parseTimeFormat(value: unknown): TimeFormat | null {
  if (value === '12h' || value === '24h') return value
  return null
}

const setting = createPersistedSettingHook<TimeFormat>({
  key: TIME_FORMAT_SETTING_KEY,
  defaultValue: DEFAULT_TIME_FORMAT,
  parse: parseTimeFormat,
})

export function useTimeFormat() {
  const [timeFormat, setTimeFormat] = setting.useSetting()
  return { timeFormat, setTimeFormat }
}
