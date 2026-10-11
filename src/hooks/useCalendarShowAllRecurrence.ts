import {
  createPersistedSettingHook,
  parseBooleanSetting,
} from '@/hooks/createPersistedSettingHook'

/** When true, calendar paints every future cycle of recurring tasks in the visible range. */
export const CALENDAR_SHOW_ALL_RECURRENCE_KEY = 'calendar_show_all_recurrence'
export const DEFAULT_SHOW_ALL_RECURRENCE = false

const setting = createPersistedSettingHook<boolean>({
  key: CALENDAR_SHOW_ALL_RECURRENCE_KEY,
  defaultValue: DEFAULT_SHOW_ALL_RECURRENCE,
  parse: parseBooleanSetting,
})

export function useCalendarShowAllRecurrence() {
  const [showAllRecurrence, setShowAllRecurrence] = setting.useSetting()
  return { showAllRecurrence, setShowAllRecurrence }
}
