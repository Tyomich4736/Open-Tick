import { useCallback, useEffect, useState } from 'react'
import {
  defaultSortForView,
  listShowCompletedSettingKey,
  listSortSettingKey,
  type SmartListId,
  type TaskSortMode,
} from '@shared/filters'
import { ipc } from '@/lib/ipc-client'

async function readSetting<T>(key: string): Promise<T | null> {
  const result = await ipc.settings.get<T>(key)
  if (!result.ok) return null
  return (result.data as T | null) ?? null
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const result = await ipc.settings.set(key, value)
  if (!result.ok) {
    console.error('Failed to save setting', key, result.error)
  }
}

/** Local-first list prefs: UI updates immediately; disk write is fire-and-forget. */
export function useListPreferences(scope: string, smartList?: SmartListId | null) {
  const [sort, setSortState] = useState<TaskSortMode>(() => defaultSortForView(smartList))
  const [showCompleted, setShowCompletedState] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fallbackSort = defaultSortForView(smartList)

    void (async () => {
      const [storedSort, storedShow] = await Promise.all([
        readSetting<TaskSortMode>(listSortSettingKey(scope)),
        readSetting<boolean>(listShowCompletedSettingKey(scope)),
      ])
      if (cancelled) return
      setSortState(storedSort ?? fallbackSort)
      setShowCompletedState(typeof storedShow === 'boolean' ? storedShow : false)
    })()

    return () => {
      cancelled = true
    }
  }, [scope, smartList])

  const setSort = useCallback(
    (next: TaskSortMode) => {
      setSortState(next)
      void writeSetting(listSortSettingKey(scope), next)
    },
    [scope],
  )

  const setShowCompleted = useCallback(
    (next: boolean) => {
      setShowCompletedState(next)
      void writeSetting(listShowCompletedSettingKey(scope), next)
    },
    [scope],
  )

  return { sort, showCompleted, setSort, setShowCompleted }
}
