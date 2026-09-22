import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueries, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CheckSquare } from 'lucide-react'
import type { TaskFilter } from '@shared/filters'
import type { TaskListItem } from '@shared/entities'
import { useTasks } from '@/hooks/useTasks'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useListDensity } from '@/hooks/useLayoutSettings'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Collapse } from '@/components/ui/Collapse'
import { TaskRow } from '@/components/tasks/TaskRow'

function isTaskExpanded(
  task: TaskListItem,
  expandedTaskIds: Record<string, boolean>,
): boolean {
  return expandedTaskIds[task.id] ?? task.subtask_count > 0
}

function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

/** Collect parent ids that are expanded and may have children to load (any depth). */
function collectExpandedParentIds(
  roots: TaskListItem[],
  expandedTaskIds: Record<string, boolean>,
  getChildren: (parentId: string) => TaskListItem[] | undefined,
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()

  const walk = (tasks: TaskListItem[]) => {
    for (const task of tasks) {
      if (!isTaskExpanded(task, expandedTaskIds) || task.subtask_count <= 0) continue
      if (seen.has(task.id)) continue
      seen.add(task.id)
      ids.push(task.id)
      const children = getChildren(task.id)
      if (children?.length) walk(children)
    }
  }

  walk(roots)
  return ids
}

interface TaskListProps {
  filter: TaskFilter
  allowReorder?: boolean
  emptyTitle?: string
  emptyDescription?: string
  /** When false, render nothing for an empty list (used under section headers). */
  showEmptyState?: boolean
}

type DropPosition = 'before' | 'after' | 'into'
type DropIndicator = { targetId: string; position: DropPosition }

const PAGE_SIZE = 30
const VIRTUALIZE_THRESHOLD = 80

type FlatItem = {
  task: TaskListItem
  depth: number
  parentId: string | null
}

function DropPlaceholder({ depth = 0 }: { depth?: number }) {
  return (
    <div
      className="pointer-events-none relative z-10 h-0"
      style={{ marginLeft: `${16 + depth * 20}px` }}
      aria-hidden
    >
      <div className="absolute inset-x-4 -top-px flex items-center">
        <span className="size-2 shrink-0 rounded-full bg-accent" />
        <span className="h-0.5 flex-1 rounded-full bg-accent" />
      </div>
    </div>
  )
}

function isDescendant(
  taskId: string,
  possibleAncestorId: string,
  parentById: Map<string, string | null>,
): boolean {
  let current: string | null = taskId
  const seen = new Set<string>()
  while (current) {
    if (current === possibleAncestorId) return true
    if (seen.has(current)) break
    seen.add(current)
    current = parentById.get(current) ?? null
  }
  return false
}

export function TaskList({
  filter,
  allowReorder = true,
  emptyTitle = 'No tasks here',
  emptyDescription = 'Add a task above to get started',
  showEmptyState = true,
}: TaskListProps) {
  const { data: tasks = [], isPending, isError } = useTasks(filter)
  const { toggleComplete, reorderTasks, updateTask } = useTaskMutations()
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const toggleSelect = useTaskSelectionStore((s) => s.toggle)
  const rangeTo = useTaskSelectionStore((s) => s.rangeTo)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const expandedTaskIds = useUiStore((s) => s.expandedTaskIds)
  const toggleExpanded = useUiStore((s) => s.toggleExpanded)
  const setTaskExpanded = useUiStore((s) => s.setTaskExpanded)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const queryClient = useQueryClient()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const [localRootOrder, setLocalRootOrder] = useState<string[] | null>(null)
  const [visibleRootCount, setVisibleRootCount] = useState(PAGE_SIZE)
  const [parentIdsToLoad, setParentIdsToLoad] = useState<string[]>([])
  const { density } = useListDensity()
  const rowEstimate = density === 'compact' ? 36 : 44
  const suppressClickRef = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    scrollParentRef.current =
      (listRef.current?.closest('.overflow-y-auto') as HTMLElement | null) ?? null
  })

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
    setDragId(null)
    setDropIndicator(null)
    const initial =
      filter.search || tasks.length > VIRTUALIZE_THRESHOLD
        ? Math.max(PAGE_SIZE * 5, 150)
        : PAGE_SIZE
    setVisibleRootCount(initial)
    setParentIdsToLoad([])
  }, [filterKey, filter.search, tasks.length])

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

  // Grow the set of parents to fetch as nested expanded nodes appear in cache
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

  // Keep last-known children so collapse can animate out after unload
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

  const flatItems = useMemo(() => {
    const items: FlatItem[] = []

    const walk = (task: TaskListItem, depth: number, parentId: string | null) => {
      items.push({ task, depth, parentId })
      if (!isTaskExpanded(task, expandedTaskIds)) return
      const children = childrenByParent.get(task.id) ?? childrenCacheRef.current.get(task.id) ?? []
      for (const child of children) {
        walk(child, depth + 1, task.id)
      }
    }

    for (const task of visibleRootTasks) {
      walk(task, 0, null)
    }
    return items
  }, [visibleRootTasks, childrenByParent, expandedTaskIds])

  const orderedVisibleIds = useMemo(() => flatItems.map((i) => i.task.id), [flatItems])
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const useVirtual = flatItems.length >= VIRTUALIZE_THRESHOLD

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => rowEstimate,
    overscan: 12,
    enabled: useVirtual,
  })

  useEffect(() => {
    if (!useVirtual || !hasMoreRoots) return
    const items = virtualizer.getVirtualItems()
    const last = items[items.length - 1]
    if (!last) return
    if (last.index >= flatItems.length - 8) {
      setVisibleRootCount((n) => Math.min(rootTasks.length, n + PAGE_SIZE * 2))
    }
  }, [useVirtual, hasMoreRoots, flatItems.length, rootTasks.length, virtualizer])

  useEffect(() => {
    useTaskSelectionStore.getState().onListFilterChange()
    // Clear when the list context changes (unless opening a task from search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)])

  if (isPending && tasks.length === 0) {
    return <div className="px-6 py-12 text-center text-sm text-text-muted">Loading tasks…</div>
  }

  if (isError) {
    return (
      <div className="px-6 py-12 text-center text-sm text-priority-high">
        Failed to load tasks
      </div>
    )
  }

  if (tasks.length === 0) {
    if (!showEmptyState) return null
    return (
      <EmptyState icon={CheckSquare} title={emptyTitle} description={emptyDescription} />
    )
  }

  function handleToggleComplete(task: TaskListItem) {
    toggleComplete.mutate({ id: task.id, completed: task.status === 'completed' })
  }

  function clearDragState() {
    setDragId(null)
    setDropIndicator(null)
  }

  function reorderSiblingIds(siblingIds: string[], dragTaskId: string, insertIndex: number) {
    const next = siblingIds.filter((id) => id !== dragTaskId)
    const clamped = Math.max(0, Math.min(insertIndex, next.length))
    next.splice(clamped, 0, dragTaskId)
    return next
  }

  function commitDrop(targetId: string, position: DropPosition) {
    if (!dragId || dragId === targetId) {
      clearDragState()
      return
    }

    // Cannot nest under own descendant
    if (position === 'into' && isDescendant(targetId, dragId, parentById)) {
      clearDragState()
      return
    }

    const dragParent = parentById.get(dragId) ?? null
    const targetParent = parentById.get(targetId) ?? null

    if (position === 'into') {
      updateTask.mutate({
        id: dragId,
        input: { parent_id: targetId },
      })
      // Reveal nested tasks if the parent was manually collapsed
      if (expandedTaskIds[targetId] === false) {
        setTaskExpanded(targetId, true)
      }
      clearDragState()
      return
    }

    // before/after → same parent as target (unnest or stay / reparent to target's parent)
    const newParentId = targetParent
    const siblings =
      newParentId === null
        ? rootTasks.map((t) => t.id)
        : getChildren(newParentId).map((t) => t.id)

    let insertAt = siblings.indexOf(targetId)
    if (insertAt < 0) insertAt = siblings.length
    if (position === 'after') insertAt += 1

    // If moving within same sibling list and drag is before insert point, account for removal
    if (dragParent === newParentId) {
      const from = siblings.indexOf(dragId)
      if (from >= 0 && from < insertAt) insertAt -= 1
    }

    const nextSiblingOrder = reorderSiblingIds(siblings, dragId, insertAt)

    if (dragParent !== newParentId) {
      updateTask.mutate(
        { id: dragId, input: { parent_id: newParentId } },
        {
          onSuccess: () => {
            reorderTasks.mutate(nextSiblingOrder)
            if (newParentId === null) setLocalRootOrder(nextSiblingOrder)
            clearDragState()
          },
          onError: () => clearDragState(),
        },
      )
      return
    }

    if (newParentId === null) setLocalRootOrder(nextSiblingOrder)
    reorderTasks.mutate(nextSiblingOrder)
    clearDragState()
  }

  function onRowDragOver(e: React.DragEvent, taskId: string) {
    if (!allowReorder || !dragId || dragId === taskId) return
    if (isDescendant(taskId, dragId, parentById)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // Auto-scroll near edges of the scrollable list ancestor
    const scrollParent = listRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (scrollParent) {
      const rect = scrollParent.getBoundingClientRect()
      const edge = 48
      if (e.clientY < rect.top + edge) scrollParent.scrollTop -= 12
      else if (e.clientY > rect.bottom - edge) scrollParent.scrollTop += 12
    }

    const rowRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const yRatio = (e.clientY - rowRect.top) / rowRect.height
    let position: DropPosition
    if (yRatio < 0.25) position = 'before'
    else if (yRatio > 0.75) position = 'after'
    else position = 'into'

    setDropIndicator((prev) =>
      prev?.targetId === taskId && prev.position === position
        ? prev
        : { targetId: taskId, position },
    )
  }

  return (
    <div
      ref={listRef}
      className="min-h-full"
      onClick={(e) => {
        if (e.target === e.currentTarget) clearSelection()
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setDropIndicator(null)
        }
      }}
    >
      {useVirtual ? (
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = flatItems[virtualRow.index]
            if (!item) return null
            return (
              <div
                key={item.task.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderFlatRow(item)}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {visibleRootTasks.map((task) => renderTaskNode(task, 0))}
          {hasMoreRoots && (
            <button
              type="button"
              onClick={() => setVisibleRootCount((n) => n + PAGE_SIZE)}
              className="w-full px-4 py-3 text-center text-sm font-medium text-accent hover:bg-accent/5"
            >
              Show more ({rootTasks.length - visibleRootCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  )

  function renderFlatRow(item: FlatItem): ReactNode {
    const { task, depth } = item
    const expanded = isTaskExpanded(task, expandedTaskIds)
    const children = getChildren(task.id)
    const showBefore =
      dropIndicator?.targetId === task.id && dropIndicator.position === 'before'
    const showAfter =
      dropIndicator?.targetId === task.id && dropIndicator.position === 'after'
    const nestTarget =
      dropIndicator?.targetId === task.id && dropIndicator.position === 'into'

    const openMenu = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const multi = selectedIds.length >= 2 && selectedIdSet.has(task.id)
      if (!multi) selectOne(task.id)
      setContextMenu({ type: 'task', id: task.id, x: e.clientX, y: e.clientY })
    }

    return (
      <div>
        {showBefore && <DropPlaceholder depth={depth} />}
        <div
          className={
            nestTarget
              ? 'rounded-md ring-2 ring-accent ring-inset bg-accent/10'
              : undefined
          }
        >
          <TaskRow
            task={task}
            depth={depth}
            selected={selectedIdSet.has(task.id)}
            draggable={allowReorder}
            dragging={dragId === task.id}
            expanded={expanded}
            onToggleExpand={
              task.subtask_count > 0 || children.length > 0
                ? () => toggleExpanded(task.id, expanded)
                : undefined
            }
            onDragStart={(e) => {
              if (!allowReorder) return
              suppressClickRef.current = true
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', task.id)
              setDragId(task.id)
            }}
            onDragEnd={() => {
              clearDragState()
              window.setTimeout(() => {
                suppressClickRef.current = false
              }, 0)
            }}
            onDragOver={(e) => onRowDragOver(e, task.id)}
            onDrop={(e) => {
              e.preventDefault()
              const position =
                dropIndicator?.targetId === task.id ? dropIndicator.position : 'before'
              commitDrop(task.id, position)
            }}
            onSelect={(e) => {
              if (suppressClickRef.current) return
              if (e.shiftKey) rangeTo(task.id, orderedVisibleIds)
              else if (e.ctrlKey || e.metaKey) toggleSelect(task.id)
              else selectOne(task.id)
            }}
            onToggleComplete={() => handleToggleComplete(task)}
            onContextMenu={openMenu}
          />
        </div>
        {showAfter && <DropPlaceholder depth={depth} />}
      </div>
    )
  }

  function renderTaskNode(task: TaskListItem, depth: number): ReactNode {
    const expanded = isTaskExpanded(task, expandedTaskIds)
    const children = getChildren(task.id)
    const showBefore =
      dropIndicator?.targetId === task.id && dropIndicator.position === 'before'
    const showAfter =
      dropIndicator?.targetId === task.id && dropIndicator.position === 'after'
    const nestTarget =
      dropIndicator?.targetId === task.id && dropIndicator.position === 'into'

    const openMenu = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const multi = selectedIds.length >= 2 && selectedIdSet.has(task.id)
      if (!multi) {
        selectOne(task.id)
      }
      setContextMenu({ type: 'task', id: task.id, x: e.clientX, y: e.clientY })
    }

    return (
      <div key={task.id}>
        {showBefore && <DropPlaceholder depth={depth} />}
        <div
          className={
            nestTarget
              ? 'rounded-md ring-2 ring-accent ring-inset bg-accent/10'
              : undefined
          }
        >
          <TaskRow
            task={task}
            depth={depth}
            selected={selectedIdSet.has(task.id)}
            draggable={allowReorder}
            dragging={dragId === task.id}
            expanded={expanded}
            onToggleExpand={
              task.subtask_count > 0 || children.length > 0
                ? () => toggleExpanded(task.id, expanded)
                : undefined
            }
            onDragStart={(e) => {
              if (!allowReorder) return
              suppressClickRef.current = true
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', task.id)
              setDragId(task.id)
            }}
            onDragEnd={() => {
              clearDragState()
              window.setTimeout(() => {
                suppressClickRef.current = false
              }, 0)
            }}
            onDragOver={(e) => onRowDragOver(e, task.id)}
            onDrop={(e) => {
              e.preventDefault()
              const position =
                dropIndicator?.targetId === task.id ? dropIndicator.position : 'before'
              commitDrop(task.id, position)
            }}
            onSelect={(e) => {
              if (suppressClickRef.current) return
              if (e.shiftKey) {
                rangeTo(task.id, orderedVisibleIds)
              } else if (e.ctrlKey || e.metaKey) {
                toggleSelect(task.id)
              } else {
                selectOne(task.id)
              }
            }}
            onToggleComplete={() => handleToggleComplete(task)}
            onContextMenu={openMenu}
          />
        </div>
        {showAfter && <DropPlaceholder depth={depth} />}
        {children.length > 0 && (
          <Collapse open={expanded}>
            {children.map((child) => renderTaskNode(child, depth + 1))}
          </Collapse>
        )}
      </div>
    )
  }
}
