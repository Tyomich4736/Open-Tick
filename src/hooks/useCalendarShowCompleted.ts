import {
  createPersistedSettingHook,
  parseBooleanSetting,
} from '@/hooks/createPersistedSettingHook'

/** When true, calendar views include completed tasks (struck-through titles). */
export const CALENDAR_SHOW_COMPLETED_KEY = 'calendar_show_completed'
export const DEFAULT_SHOW_COMPLETED = false

const setting = createPersistedSettingHook<boolean>({
  key: CALENDAR_SHOW_COMPLETED_KEY,
  defaultValue: DEFAULT_SHOW_COMPLETED,
  parse: parseBooleanSetting,
})

export function useCalendarShowCompleted() {
  const [showCompleted, setShowCompleted] = setting.useSetting()
  return { showCompleted, setShowCompleted }
}
