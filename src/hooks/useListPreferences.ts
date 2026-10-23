import { useCallback, useEffect, useState } from 'react'
import {
  defaultGroupByForView,
  defaultSortForView,
  listGroupBySettingKey,
  listShowCompletedSettingKey,
  listSortSettingKey,
  type SmartListId,
  type TaskGroupBy,
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

const GROUP_BY_VALUES = new Set<TaskGroupBy>([
  'none',
  'section',
  'date',
  'list',
  'tag',
  'priority',
])

function parseGroupBy(value: unknown, fallback: TaskGroupBy): TaskGroupBy {
  if (value === 'created') return 'none'
  return typeof value === 'string' && GROUP_BY_VALUES.has(value as TaskGroupBy)
    ? (value as TaskGroupBy)
    : fallback
}

/**
 * Local-first list prefs: UI updates immediately; disk write is fire-and-forget.
 * Pass `allowListGroup` false for project/tag views so a stored "list" group falls back.
 * Pass `allowSectionGroup` false for smart/tag views that don't support sections.
 */
export function useListPreferences(
  scope: string,
  smartList?: SmartListId | null,
  options?: {
    allowListGroup?: boolean
    allowSectionGroup?: boolean
    viewKind?: 'smart' | 'project' | 'tag'
  },
) {
  const allowListGroup = options?.allowListGroup ?? true
  const allowSectionGroup = options?.allowSectionGroup ?? true
  const viewKind = options?.viewKind
  const [sort, setSortState] = useState<TaskSortMode>(() => defaultSortForView(smartList))
  const [showCompleted, setShowCompletedState] = useState(false)
  const [groupBy, setGroupByState] = useState<TaskGroupBy>(() =>
    defaultGroupByForView(viewKind),
  )

  useEffect(() => {
    let cancelled = false
    const fallbackSort = defaultSortForView(smartList)
    const fallbackGroup = defaultGroupByForView(viewKind)

    void (async () => {
      const [storedSort, storedShow, storedGroup] = await Promise.all([
        readSetting<TaskSortMode>(listSortSettingKey(scope)),
        readSetting<boolean>(listShowCompletedSettingKey(scope)),
        readSetting<TaskGroupBy>(listGroupBySettingKey(scope)),
      ])
      if (cancelled) return
      setSortState(storedSort ?? fallbackSort)
      setShowCompletedState(typeof storedShow === 'boolean' ? storedShow : false)
      let nextGroup = parseGroupBy(storedGroup, fallbackGroup)
      if (!allowListGroup && nextGroup === 'list') nextGroup = 'none'
      if (!allowSectionGroup && nextGroup === 'section') nextGroup = fallbackGroup
      setGroupByState(nextGroup)
    })()

    return () => {
      cancelled = true
    }
  }, [scope, smartList, allowListGroup, allowSectionGroup, viewKind])

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

  const setGroupBy = useCallback(
    (next: TaskGroupBy) => {
      let resolved = next
      if (!allowListGroup && resolved === 'list') resolved = 'none'
      if (!allowSectionGroup && resolved === 'section') {
        resolved = defaultGroupByForView(viewKind)
      }
      setGroupByState(resolved)
      void writeSetting(listGroupBySettingKey(scope), resolved)
    },
    [scope, allowListGroup, allowSectionGroup, viewKind],
  )

  return { sort, showCompleted, groupBy, setSort, setShowCompleted, setGroupBy }
}
