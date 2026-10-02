import { useQuery, keepPreviousData } from '@tanstack/react-query'
import type { TaskFilter } from '@shared/filters'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'

/** Stable query key so key order / undefined fields do not thrash the cache. */
export function stableTaskFilterKey(filter: TaskFilter): Record<string, unknown> {
  return {
    project_id: filter.project_id ?? null,
    smart_list: filter.smart_list ?? null,
    status: filter.status ?? null,
    tag: filter.tag ?? null,
    search: filter.search ?? null,
    parent_id: filter.parent_id === undefined ? '__omit__' : filter.parent_id,
    sort: filter.sort ?? 'order',
    include_completed: filter.include_completed ?? false,
    include_recurring_series: filter.include_recurring_series ?? false,
    due_from: filter.due_from ?? null,
    due_to: filter.due_to ?? null,
  }
}

export function useTasks(filter: TaskFilter) {
  const key = stableTaskFilterKey(filter)
  return useQuery({
    queryKey: queryKeys.tasks(key),
    queryFn: async () => unwrapIpc(await ipc.tasks.list(filter)),
    placeholderData: keepPreviousData,
  })
}

export function useTaskCount(filter: TaskFilter) {
  const key = stableTaskFilterKey(filter)
  return useQuery({
    queryKey: queryKeys.taskCount(key),
    queryFn: async () => unwrapIpc(await ipc.tasks.count(filter)),
  })
}

export function useSubtasks(parentId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.subtasks(parentId),
    queryFn: async () => unwrapIpc(await ipc.tasks.list({ parent_id: parentId })),
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: queryKeys.task(taskId ?? ''),
    queryFn: async () => unwrapIpc(await ipc.tasks.get(taskId!)),
    enabled: Boolean(taskId),
  })
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: async () => unwrapIpc(await ipc.tags.list()),
  })
}
