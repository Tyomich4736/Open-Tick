import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TaskListItem } from '@shared/entities'

export function useSelectedTaskStatuses(selectedIds: string[]) {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const all = new Map<string, 'pending' | 'completed'>()
    for (const [, data] of queryClient.getQueriesData({ queryKey: ['tasks'] })) {
      if (!Array.isArray(data)) continue
      for (const item of data as TaskListItem[]) {
        if (item && typeof item === 'object' && 'id' in item) {
          all.set(item.id, item.status)
        }
      }
    }
    const statuses = new Map<string, 'pending' | 'completed'>()
    for (const id of selectedIds) {
      const status = all.get(id)
      if (status) statuses.set(id, status)
    }
    return statuses
  }, [selectedIds, queryClient])
}
