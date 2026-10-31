import type { QueryClient, Query } from '@tanstack/react-query'
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

type ListItemPatch = Partial<
  Pick<
    TaskListItem,
    | 'status'
    | 'section_id'
    | 'section_name'
    | 'section_sort'
    | 'subtask_count'
    | 'completed_subtask_count'
  >
>

function isTaskList(data: unknown): data is TaskListItem[] {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return true
  return typeof (data[0] as TaskListItem).status === 'string'
}

function isRootTaskListQuery(query: Query): boolean {
  const key = query.queryKey
  return key[0] === 'tasks' && key[1] !== 'subtasks' && key[1] !== 'detail' && key[1] !== 'count'
}

function patchListItem(item: TaskListItem, id: string, patch: ListItemPatch): TaskListItem {
  if (item.id !== id) return item
  return { ...item, ...patch }
}

export function patchTaskInListCaches(
  queryClient: QueryClient,
  id: string,
  patch: ListItemPatch,
): void {
  queryClient.setQueriesData<TaskListItem[]>({ queryKey: ['tasks'] }, (old) => {
    if (!isTaskList(old)) return old
    return old.map((item) => patchListItem(item, id, patch))
  })
  queryClient.setQueryData(queryKeys.task(id), (old: unknown) => {
    if (!old || typeof old !== 'object') return old
    return { ...(old as object), ...patch }
  })
}

function adjustSubtaskCount(
  queryClient: QueryClient,
  parentId: string,
  delta: number,
): void {
  if (delta === 0) return
  queryClient.setQueriesData<TaskListItem[]>({ queryKey: ['tasks'] }, (old) => {
    if (!isTaskList(old)) return old
    return old.map((item) => {
      if (item.id !== parentId) return item
      return {
        ...item,
        subtask_count: Math.max(0, item.subtask_count + delta),
      }
    })
  })
  queryClient.setQueryData(queryKeys.task(parentId), (old: unknown) => {
    if (!old || typeof old !== 'object') return old
    const current = old as { subtask_count?: number }
    return {
      ...current,
      subtask_count: Math.max(0, (current.subtask_count ?? 0) + delta),
    }
  })
}

/**
 * Keep root lists + subtask caches consistent when parent_id changes.
 * Prevents "duplicate" rows (still under old parent cache + already a root).
 */
export function applyTaskParentMoveInCaches(
  queryClient: QueryClient,
  input: {
    task: TaskListItem
    fromParentId: string | null
    toParentId: string | null
    section?: {
      section_id: string | null
      section_name: string | null
      section_sort: number | null
    }
  },
): void {
  const { task, fromParentId, toParentId, section } = input
  if (fromParentId === toParentId && !section) return

  const moved: TaskListItem = section ? { ...task, ...section } : { ...task }

  if (fromParentId) {
    queryClient.setQueryData<TaskListItem[]>(
      queryKeys.subtasks(fromParentId),
      (old) => (old ?? []).filter((t) => t.id !== task.id),
    )
    adjustSubtaskCount(queryClient, fromParentId, -1)
  } else {
    queryClient.setQueriesData<TaskListItem[]>(
      { predicate: isRootTaskListQuery },
      (old) => {
        if (!isTaskList(old)) return old
        return old.filter((t) => t.id !== task.id)
      },
    )
  }

  if (toParentId) {
    queryClient.setQueryData<TaskListItem[]>(queryKeys.subtasks(toParentId), (old) => {
      const list = old ?? []
      if (list.some((t) => t.id === task.id)) return list
      return [...list, moved]
    })
    adjustSubtaskCount(queryClient, toParentId, 1)
  } else {
    queryClient.setQueriesData<TaskListItem[]>(
      { predicate: isRootTaskListQuery },
      (old) => {
        if (!isTaskList(old)) return old
        if (old.some((t) => t.id === task.id)) {
          return section
            ? old.map((t) => (t.id === task.id ? { ...t, ...section } : t))
            : old
        }
        return [...old, moved]
      },
    )
  }

  if (section) {
    queryClient.setQueryData(queryKeys.task(task.id), (old: unknown) => {
      if (!old || typeof old !== 'object') return old
      return { ...(old as object), ...section }
    })
  }
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
