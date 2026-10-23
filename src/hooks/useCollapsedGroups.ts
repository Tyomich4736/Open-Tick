import { useCallback, useEffect, useState } from 'react'
import { listGroupCollapsedSettingKey, type TaskGroupBy } from '@shared/filters'
import { ipc } from '@/lib/ipc-client'

type CollapsedMap = Record<string, true>

async function readCollapsed(key: string): Promise<CollapsedMap> {
  const result = await ipc.settings.get<CollapsedMap>(key)
  if (!result.ok || !result.data || typeof result.data !== 'object') return {}
  const out: CollapsedMap = {}
  for (const [k, v] of Object.entries(result.data)) {
    if (v === true) out[k] = true
  }
  return out
}

/**
 * Persist which task-list groups are collapsed for a view scope + groupBy mode.
 * Default is expanded (key absent).
 */
export function useCollapsedGroups(scope: string, groupBy: TaskGroupBy) {
  const [collapsed, setCollapsed] = useState<CollapsedMap>({})

  useEffect(() => {
    if (groupBy === 'none') {
      setCollapsed({})
      return
    }
    let cancelled = false
    const key = listGroupCollapsedSettingKey(scope, groupBy)
    void readCollapsed(key).then((map) => {
      if (!cancelled) setCollapsed(map)
    })
    return () => {
      cancelled = true
    }
  }, [scope, groupBy])

  const isCollapsed = useCallback((groupKey: string) => collapsed[groupKey] === true, [collapsed])

  const toggleCollapsed = useCallback(
    (groupKey: string) => {
      if (groupBy === 'none') return
      setCollapsed((prev) => {
        const next: CollapsedMap = { ...prev }
        if (next[groupKey]) delete next[groupKey]
        else next[groupKey] = true
        void ipc.settings.set(listGroupCollapsedSettingKey(scope, groupBy), next)
        return next
      })
    },
    [scope, groupBy],
  )

  return { isCollapsed, toggleCollapsed }
}
