import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc-client'

export interface PersistedSettingOptions<T> {
  key: string
  defaultValue: T
  /** Return null to keep the current/default value. */
  parse: (value: unknown) => T | null
}

export interface PersistedSettingApi<T> {
  key: string
  defaultValue: T
  /** Sync snapshot for pure helpers (updated when settings load / change). */
  getValue: () => T
  /** Resolves after the first settings read (shared in-flight). */
  whenReady: () => Promise<void>
  useSetting: () => readonly [T, (next: T) => void]
}

/**
 * Factory for local-first settings: module cache + listeners + ipc.settings get/set.
 * Each call creates an isolated cache (one setting per factory invocation).
 */
export function createPersistedSettingHook<T>(
  options: PersistedSettingOptions<T>,
): PersistedSettingApi<T> {
  let cached = options.defaultValue
  let loadPromise: Promise<void> | null = null
  const listeners = new Set<(v: T) => void>()

  function notify(next: T) {
    cached = next
    for (const listener of listeners) listener(next)
  }

  function ensureLoaded(): Promise<void> {
    if (!loadPromise) {
      loadPromise = (async () => {
        const result = await ipc.settings.get<unknown>(options.key)
        if (result.ok) {
          const parsed = options.parse(result.data)
          if (parsed != null) notify(parsed)
        }
      })()
    }
    return loadPromise
  }

  function getValue(): T {
    return cached
  }

  function useSetting() {
    const [value, setState] = useState(cached)

    useEffect(() => {
      listeners.add(setState)
      void ensureLoaded()
      return () => {
        listeners.delete(setState)
      }
    }, [])

    const setValue = useCallback((next: T) => {
      notify(next)
      void ipc.settings.set(options.key, next)
    }, [])

    return [value, setValue] as const
  }

  return {
    key: options.key,
    defaultValue: options.defaultValue,
    getValue,
    whenReady: ensureLoaded,
    useSetting,
  }
}

export function parseBooleanSetting(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1 || value === '1') return true
  if (value === 'false' || value === 0 || value === '0') return false
  return null
}
