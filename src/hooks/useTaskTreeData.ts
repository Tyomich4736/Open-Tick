import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQueries, useQueryClient } from '@tanstack/react-query'
import type { TaskFilter } from '@shared/filters'
import type { TaskListItem } from '@shared/entities'
import { useTasks } from '@/hooks/useTasks'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'
import {
  collectExpandedParentIds,
  flattenTaskTree,
  sameIdList,
  type FlatItem,
} from '@/lib/taskTree'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

export const TASK_LIST_PAGE_SIZE = 30
export const TASK_LIST_VIRTUALIZE_THRESHOLD = 20

export function useTaskTreeData(filter: TaskFilter) {
  const { data: tasks = [], isPending, isError } = useTasks(filter)
  const expandedTaskIds = useUiStore((s) => s.expandedTaskIds)
  const queryClient = useQueryClient()
  const [localRootOrder, setLocalRootOrder] = useState<string[] | null>(null)
  const [visibleRootCount, setVisibleRootCount] = useState(TASK_LIST_PAGE_SIZE)
  const [parentIdsToLoad, setParentIdsToLoad] = useState<string[]>([])

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        project_id: filter.project_id ?? null,
        smart_list: filter.smart_list ?? null,
        sort: filter.sort ?? 'order',
        include_completed: filter.include_completed ?? false,
        parent_id: filter.parent_id ?? null,
      }),
    [filter],
  )

  useEffect(() => {
    setLocalRootOrder(null)
    const initial =
      filter.search || tasks.length > TASK_LIST_VIRTUALIZE_THRESHOLD
        ? Math.max(TASK_LIST_PAGE_SIZE * 5, 150)
        : TASK_LIST_PAGE_SIZE
    setVisibleRootCount(initial)
    setParentIdsToLoad([])
  }, [filterKey, filter.search, tasks.length])

  useEffect(() => {
    useTaskSelectionStore.getState().onListFilterChange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)])

  const rootTasks = useMemo(() => {
    if (!localRootOrder) return tasks
    const map = new Map(tasks.map((t) => [t.id, t]))
    return localRootOrder.map((id) => map.get(id)).filter(Boolean) as TaskListItem[]
  }, [tasks, localRootOrder])

  const visibleRootTasks = useMemo(
    () => rootTasks.slice(0, visibleRootCount),
    [rootTasks, visibleRootCount],
  )

  const hasMoreRoots = rootTasks.length > visibleRootCount

  const subtaskQueryResults = useQueries({
    queries: parentIdsToLoad.map((parentId) => ({
      queryKey: queryKeys.subtasks(parentId),
      queryFn: async () => unwrapIpc(await ipc.tasks.list({ parent_id: parentId })),
      placeholderData: keepPreviousData,
    })),
  })

  const subtaskDataTick = subtaskQueryResults
    .map((r) => `${r.dataUpdatedAt}:${r.data?.length ?? 0}`)
    .join('|')

  useEffect(() => {
    const next = collectExpandedParentIds(
      visibleRootTasks,
      expandedTaskIds,
      (parentId) =>
        queryClient.getQueryData<TaskListItem[]>(queryKeys.subtasks(parentId)),
    )
    setParentIdsToLoad((prev) => (sameIdList(prev, next) ? prev : next))
  }, [visibleRootTasks, expandedTaskIds, queryClient, subtaskDataTick])

  const childrenByParent = useMemo(() => {
    const map = new Map<string, TaskListItem[]>()
    parentIdsToLoad.forEach((parentId, index) => {
      map.set(parentId, subtaskQueryResults[index]?.data ?? [])
    })
    return map
  }, [parentIdsToLoad, subtaskQueryResults])

  const childrenCacheRef = useRef(new Map<string, TaskListItem[]>())
  useEffect(() => {
    for (const [id, kids] of childrenByParent) {
      if (kids.length > 0) childrenCacheRef.current.set(id, kids)
    }
  }, [childrenByParent])

  function getChildren(parentId: string): TaskListItem[] {
    return childrenByParent.get(parentId) ?? childrenCacheRef.current.get(parentId) ?? []
  }

  const parentById = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const task of rootTasks) map.set(task.id, null)
    for (const [parentId, children] of childrenByParent) {
      for (const child of children) map.set(child.id, parentId)
    }
    return map
  }, [rootTasks, childrenByParent])

  const flatItems = useMemo((): FlatItem[] => {
    return flattenTaskTree(visibleRootTasks, expandedTaskIds, (parentId) => {
      return childrenByParent.get(parentId) ?? childrenCacheRef.current.get(parentId) ?? []
    })
  }, [visibleRootTasks, childrenByParent, expandedTaskIds])

  const orderedVisibleIds = useMemo(() => flatItems.map((i) => i.task.id), [flatItems])

  return {
    tasks,
    isPending,
    isError,
    filterKey,
    rootTasks,
    visibleRootTasks,
    hasMoreRoots,
    visibleRootCount,
    setVisibleRootCount,
    flatItems,
    orderedVisibleIds,
    parentById,
    getChildren,
    expandedTaskIds,
    setLocalRootOrder,
    pageSize: TASK_LIST_PAGE_SIZE,
    virtualizeThreshold: TASK_LIST_VIRTUALIZE_THRESHOLD,
  }
}
