import type { QueryClient } from '@tanstack/react-query'
import type { TaskListItem, TaskStatus } from '@shared/entities'
import { queryKeys } from '@/lib/queryClient'

/** Suppress IPC-driven task invalidation briefly after optimistic local updates. */
let suppressTaskInvalidateUntil = 0

export function suppressTaskInvalidation(ms = 120): void {
  suppressTaskInvalidateUntil = Date.now() + ms
}

export function shouldSuppressTaskInvalidation(): boolean {
  return Date.now() < suppressTaskInvalidateUntil
}

function patchListItem(
  item: TaskListItem,
  id: string,
  patch: Partial<Pick<TaskListItem, 'status'>>,
): TaskListItem {
  if (item.id !== id) return item
  return { ...item, ...patch }
}

export function patchTaskInListCaches(
  queryClient: QueryClient,
  id: string,
  patch: Partial<Pick<TaskListItem, 'status'>>,
): void {
  queryClient.setQueriesData<TaskListItem[]>({ queryKey: ['tasks'] }, (old) => {
    if (!Array.isArray(old)) return old
    // Skip detail/subtasks key shapes that aren't flat lists of TaskListItem with status
    if (old.length > 0 && typeof (old[0] as TaskListItem).status !== 'string') return old
    return old.map((item) => patchListItem(item, id, patch))
  })
}

export function setTaskStatusInCaches(
  queryClient: QueryClient,
  id: string,
  status: TaskStatus,
): void {
  patchTaskInListCaches(queryClient, id, { status })
  queryClient.setQueryData(queryKeys.task(id), (old: unknown) => {
    if (!old || typeof old !== 'object') return old
    return { ...(old as object), status }
  })
}

export function reorderTaskListCaches(
  queryClient: QueryClient,
  orderedIds: string[],
): void {
  const order = new Map(orderedIds.map((id, i) => [id, i]))
  queryClient.setQueriesData<TaskListItem[]>({ queryKey: ['tasks'] }, (old) => {
    if (!Array.isArray(old) || old.length === 0) return old
    if (typeof (old[0] as TaskListItem).status !== 'string') return old
    const inOrder = old.filter((t) => order.has(t.id))
    if (inOrder.length < 2) return old
    const rest = old.filter((t) => !order.has(t.id))
    inOrder.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    // Preserve relative positions of unordered items by splicing sorted block at first match
    const firstIdx = old.findIndex((t) => order.has(t.id))
    if (firstIdx < 0) return old
    const before = old.slice(0, firstIdx).filter((t) => !order.has(t.id))
    const after = rest.filter((t) => !before.includes(t))
    return [...before, ...inOrder, ...after]
  })
}

/** Invalidate list/count queries; optionally a specific task detail. */
export function invalidateTaskQueries(
  queryClient: QueryClient,
  opts?: { taskId?: string; lists?: boolean },
): void {
  const lists = opts?.lists !== false
  if (lists) {
    void queryClient.invalidateQueries({
      queryKey: ['tasks'],
      refetchType: 'active',
      predicate: (q) => {
        const key = q.queryKey
        // Keep detail keys unless explicitly requested below
        return !(key.length >= 2 && key[1] === 'detail')
      },
    })
  }
  if (opts?.taskId) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.task(opts.taskId),
      refetchType: 'active',
    })
  }
}
