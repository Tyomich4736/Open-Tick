import { useEffect, useState } from 'react'
import {
  DEFAULT_SMART_LISTS_CONFIG,
  SMART_LIST_SETTINGS_KEY,
  defaultSmartListPath,
  parseSmartListsConfig,
  type SmartListsConfig,
} from '@shared/smartListSettings'
import { createPersistedSettingHook } from '@/hooks/createPersistedSettingHook'

const setting = createPersistedSettingHook<SmartListsConfig>({
  key: SMART_LIST_SETTINGS_KEY,
  defaultValue: DEFAULT_SMART_LISTS_CONFIG,
  parse: parseSmartListsConfig,
})

export function getSmartListsConfig(): SmartListsConfig {
  return setting.getValue()
}

export function getDefaultSmartListPath(): string {
  return defaultSmartListPath(setting.getValue())
}

export function useSmartListSettings() {
  const [config, setConfig] = setting.useSetting()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void setting.whenReady().then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { config, setConfig, ready, defaultPath: defaultSmartListPath(config) }
}
