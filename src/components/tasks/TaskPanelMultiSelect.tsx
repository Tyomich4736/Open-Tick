import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckSquare } from 'lucide-react'
import type { TaskListItem } from '@shared/entities'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

function useCachedTaskMeta(selectedIds: string[]) {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const titles = new Map<string, string>()
    const statuses = new Map<string, 'pending' | 'completed'>()
    for (const [, data] of queryClient.getQueriesData({ queryKey: ['tasks'] })) {
      if (!Array.isArray(data)) continue
      for (const item of data as TaskListItem[]) {
        if (item && typeof item === 'object' && 'id' in item) {
          titles.set(item.id, item.title)
          statuses.set(item.id, item.status)
        }
      }
    }
    return {
      titles: selectedIds.map((id) => ({
        id,
        title: titles.get(id) ?? 'Task',
      })),
      statuses,
    }
  }, [selectedIds, queryClient])
}

export function TaskPanelMultiSelect() {
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const { titles } = useCachedTaskMeta(selectedIds)
  const n = selectedIds.length
  const shown = titles.slice(0, 5)
  const extra = n - shown.length

  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-bg-sidebar">
      <div className="flex items-center border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Details</h3>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <CheckSquare className="size-7" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {n} task{n === 1 ? '' : 's'} selected
          </p>
          <p className="mt-1 text-xs text-text-muted">Right-click selection for bulk actions</p>
        </div>
        {shown.length > 0 && (
          <ul className="w-full max-w-xs space-y-1 text-left">
            {shown.map((t) => (
              <li
                key={t.id}
                className="truncate rounded-md bg-bg-primary px-2.5 py-1.5 text-xs text-text-muted"
              >
                {t.title}
              </li>
            ))}
            {extra > 0 && (
              <li className="px-2.5 text-xs text-text-muted">and {extra} more</li>
            )}
          </ul>
        )}
      </div>
    </aside>
  )
}

export function useSelectedTaskStatuses(selectedIds: string[]) {
  const { statuses } = useCachedTaskMeta(selectedIds)
  return statuses
}
