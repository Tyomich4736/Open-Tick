import { useCallback, useEffect, useState } from 'react'
import {
  DESKTOP_DEFAULTS,
  DESKTOP_SETTING_KEYS,
  type DesktopSettingsSnapshot,
} from '@shared/desktopSettings'
import { ipc } from '@/lib/ipc-client'

async function loadDesktopSettings(): Promise<DesktopSettingsSnapshot> {
  const get = async <T>(key: string, fallback: T): Promise<T> => {
    const result = await ipc.settings.get<T>(key)
    if (result.ok && result.data !== null && result.data !== undefined) return result.data
    return fallback
  }

  return {
    notificationsEnabled: await get(
      DESKTOP_SETTING_KEYS.notificationsEnabled,
      DESKTOP_DEFAULTS.notificationsEnabled,
    ),
    notificationLeadMinutes: await get(
      DESKTOP_SETTING_KEYS.notificationLeadMinutes,
      DESKTOP_DEFAULTS.notificationLeadMinutes,
    ),
    minimizeToTray: await get(
      DESKTOP_SETTING_KEYS.minimizeToTray,
      DESKTOP_DEFAULTS.minimizeToTray,
    ),
    autoStart: await get(DESKTOP_SETTING_KEYS.autoStart, DESKTOP_DEFAULTS.autoStart),
    shortcutQuickCapture: await get(
      DESKTOP_SETTING_KEYS.shortcutQuickCapture,
      DESKTOP_DEFAULTS.shortcutQuickCapture,
    ),
    shortcutNewSticky: await get(
      DESKTOP_SETTING_KEYS.shortcutNewSticky,
      DESKTOP_DEFAULTS.shortcutNewSticky,
    ),
    stickyPinByDefault: await get(
      DESKTOP_SETTING_KEYS.stickyPinByDefault,
      DESKTOP_DEFAULTS.stickyPinByDefault,
    ),
  }
}

const KEY_MAP: Record<keyof DesktopSettingsSnapshot, string> = {
  notificationsEnabled: DESKTOP_SETTING_KEYS.notificationsEnabled,
  notificationLeadMinutes: DESKTOP_SETTING_KEYS.notificationLeadMinutes,
  minimizeToTray: DESKTOP_SETTING_KEYS.minimizeToTray,
  autoStart: DESKTOP_SETTING_KEYS.autoStart,
  shortcutQuickCapture: DESKTOP_SETTING_KEYS.shortcutQuickCapture,
  shortcutNewSticky: DESKTOP_SETTING_KEYS.shortcutNewSticky,
  stickyPinByDefault: DESKTOP_SETTING_KEYS.stickyPinByDefault,
}

const APPLY_KEYS = new Set<keyof DesktopSettingsSnapshot>([
  'autoStart',
  'minimizeToTray',
  'shortcutQuickCapture',
  'shortcutNewSticky',
])

export function useDesktopSettings() {
  const [settings, setSettings] = useState<DesktopSettingsSnapshot>({ ...DESKTOP_DEFAULTS })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void loadDesktopSettings()
      .then(setSettings)
      .finally(() => setReady(true))
  }, [])

  const update = useCallback(
    async <K extends keyof DesktopSettingsSnapshot>(
      key: K,
      value: DesktopSettingsSnapshot[K],
    ) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      await ipc.settings.set(KEY_MAP[key], value)
      if (APPLY_KEYS.has(key)) {
        await ipc.desktop.applySettings()
      }
    },
    [],
  )

  return { settings, ready, update }
}
