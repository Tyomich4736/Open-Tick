import type { WeekStartsOn } from '@/lib/calendarUtils'
import { createPersistedSettingHook } from '@/hooks/createPersistedSettingHook'

export const WEEK_STARTS_ON_KEY = 'week_starts_on'
export const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = 1

function parseWeekStarts(value: unknown): WeekStartsOn | null {
  if (value === 0 || value === '0') return 0
  if (value === 1 || value === '1') return 1
  return null
}

const setting = createPersistedSettingHook<WeekStartsOn>({
  key: WEEK_STARTS_ON_KEY,
  defaultValue: DEFAULT_WEEK_STARTS_ON,
  parse: parseWeekStarts,
})

/** Sync snapshot for pure formatters (updated when settings load / change). */
export function getWeekStartsOn(): WeekStartsOn {
  return setting.getValue()
}

export function useWeekStartsOn() {
  const [weekStartsOn, setWeekStartsOn] = setting.useSetting()
  return { weekStartsOn, setWeekStartsOn }
}
