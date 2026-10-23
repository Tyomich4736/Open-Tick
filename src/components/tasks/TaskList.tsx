import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CheckSquare, ChevronRight } from 'lucide-react'
import type { TaskFilter, TaskGroupBy } from '@shared/filters'
import type { ProjectSection, TaskListItem } from '@shared/entities'
import { groupTasks, groupTasksBySection } from '@shared/taskGroups'
import { useCollapsedGroups } from '@/hooks/useCollapsedGroups'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useListDensity } from '@/hooks/useLayoutSettings'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import {
  TASK_LIST_PAGE_SIZE,
  TASK_LIST_VIRTUALIZE_THRESHOLD,
  useTaskTreeData,
} from '@/hooks/useTaskTreeData'
import { useTaskListDnD } from '@/hooks/useTaskListDnD'
import { isTaskExpanded, type FlatItem } from '@/lib/taskTree'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { EmptyState } from '@/components/ui/EmptyState'
import { Collapse } from '@/components/ui/Collapse'
import { TaskRow } from '@/components/tasks/TaskRow'

interface TaskListProps {
  filter: TaskFilter
  allowReorder?: boolean
  emptyTitle?: string
  emptyDescription?: string
  /** When false, render nothing for an empty list (used under section headers). */
  showEmptyState?: boolean
  /** Section roots by date / list / tag / etc. */
  groupBy?: TaskGroupBy
  /** When groupBy is section, include empty TickTick sections in order. */
  sections?: ProjectSection[]
  /** Called when user clicks + under a section header. */
  onAddInSection?: (sectionId: string | null) => void
  /** View scope for persisting collapsed groups (e.g. project.abc). */
  collapseScope?: string
}

export function TaskList({
  filter,
  allowReorder = true,
  emptyTitle = 'No tasks here',
  emptyDescription = 'Add a task above to get started',
  showEmptyState = true,
  groupBy = 'none',
  sections,
  onAddInSection,
  collapseScope = 'default',
}: TaskListProps) {
  const { toggleComplete } = useTaskMutations()
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const toggleSelect = useTaskSelectionStore((s) => s.toggle)
  const rangeTo = useTaskSelectionStore((s) => s.rangeTo)
  const toggleExpanded = useUiStore((s) => s.toggleExpanded)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const { density } = useListDensity()
  const { timeFormat } = useTimeFormat()
  const rowEstimate = density === 'compact' ? 36 : 44
  const listRef = useRef<HTMLDivElement>(null)
  const scrollParentRef = useRef<HTMLElement | null>(null)
  const orderedVisibleIdsRef = useRef<string[]>([])

  const tree = useTaskTreeData(filter)
  const {
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
  } = tree

  orderedVisibleIdsRef.current = orderedVisibleIds

  const dnd = useTaskListDnD({
    allowReorder,
    listRef,
    rootTasks,
    parentById,
    getChildren,
    expandedTaskIds,
    setLocalRootOrder,
  })

  useEffect(() => {
    dnd.clearDragState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, filter.search, tasks.length])

  useEffect(() => {
    scrollParentRef.current =
      (listRef.current?.closest('.overflow-y-auto') as HTMLElement | null) ?? null
  })

  const grouping = groupBy !== 'none'
  const groups = useMemo(() => {
    if (!grouping) return null
    if (groupBy === 'section') {
      return groupTasksBySection(visibleRootTasks, sections ?? [])
    }
    return groupTasks(visibleRootTasks, groupBy)
  }, [grouping, visibleRootTasks, groupBy, sections])

  const { isCollapsed, toggleCollapsed } = useCollapsedGroups(collapseScope, groupBy)

  // Virtualization skips section headers; keep grouped lists in the simple path.
  const useVirtual = !grouping && flatItems.length >= TASK_LIST_VIRTUALIZE_THRESHOLD

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
      setVisibleRootCount((n) => Math.min(rootTasks.length, n + TASK_LIST_PAGE_SIZE * 2))
    }
  }, [
    useVirtual,
    hasMoreRoots,
    flatItems.length,
    rootTasks.length,
    virtualizer,
    setVisibleRootCount,
  ])

  const handleToggleComplete = useCallback(
    (task: TaskListItem) => {
      toggleComplete.mutate({ id: task.id, completed: task.status === 'completed' })
    },
    [toggleComplete],
  )

  function renderRow(task: TaskListItem, depth: number): ReactNode {
    const expanded = isTaskExpanded(task, expandedTaskIds)
    const children = getChildren(task.id)

    return (
      <TaskRow
        task={task}
        depth={depth}
        timeFormat={timeFormat}
        density={density}
        dropHighlight={dnd.rowDropHighlight(task.id)}
        draggable={allowReorder}
        dragging={dnd.dragId === task.id}
        expanded={expanded}
        onToggleExpand={
          task.subtask_count > 0 || children.length > 0
            ? () => toggleExpanded(task.id, expanded)
            : undefined
        }
        onDragStart={(e) => {
          if (!allowReorder) return
          dnd.suppressClickRef.current = true
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', task.id)
          dnd.setDragId(task.id)
        }}
        onDragEnd={() => {
          dnd.clearDragState()
          window.setTimeout(() => {
            dnd.suppressClickRef.current = false
          }, 0)
        }}
        onDragOver={(e) => dnd.onRowDragOver(e, task.id)}
        onDrop={(e) => {
          e.preventDefault()
          const ind = dnd.dropIndicatorRef.current
          const position = ind?.targetId === task.id ? ind.position : 'before'
          dnd.commitDrop(task.id, position)
        }}
        onSelect={(e) => {
          if (dnd.suppressClickRef.current) return
          if (e.shiftKey) rangeTo(task.id, orderedVisibleIdsRef.current)
          else if (e.ctrlKey || e.metaKey) toggleSelect(task.id)
          else selectOne(task.id)
        }}
        onToggleComplete={() => handleToggleComplete(task)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const { selectedIds } = useTaskSelectionStore.getState()
          const multi = selectedIds.length >= 2 && selectedIds.includes(task.id)
          if (!multi) selectOne(task.id)
          setContextMenu({ type: 'task', id: task.id, x: e.clientX, y: e.clientY })
        }}
      />
    )
  }

  function renderFlatItem(item: FlatItem): ReactNode {
    return renderRow(item.task, item.depth)
  }

  function renderTaskNode(task: TaskListItem, depth: number): ReactNode {
    const expanded = isTaskExpanded(task, expandedTaskIds)
    const children = getChildren(task.id)

    return (
      <div key={task.id}>
        {renderRow(task, depth)}
        {children.length > 0 && (
          <Collapse open={expanded}>
            {children.map((child) => renderTaskNode(child, depth + 1))}
          </Collapse>
        )}
      </div>
    )
  }

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

  return (
    <div
      ref={listRef}
      className="min-h-full"
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          dnd.setDropIndicator(null)
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
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${rowEstimate}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderFlatItem(item)}
              </div>
            )
          })}
        </div>
      ) : groups ? (
        <div className="pb-4">
          {groups.map((group) => {
            const expanded = !isCollapsed(group.key)
            const count = group.tasks.length
            return (
              <section key={group.key} className="pt-2">
                {group.label ? (
                  <div className="sticky top-0 z-10 flex items-center gap-2 bg-bg-primary/95 px-4 py-1.5 backdrop-blur-sm sm:px-6">
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(group.key)}
                      className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-black/5 dark:hover:bg-white/5"
                      aria-expanded={expanded}
                    >
                      <ChevronRight
                        className={[
                          'size-3.5 shrink-0 text-text-muted transition-transform duration-200 ease-out motion-reduce:transition-none',
                          expanded ? 'rotate-90' : 'rotate-0',
                        ].join(' ')}
                      />
                      <h3 className="truncate text-xs font-semibold tracking-wide text-text-muted uppercase">
                        {group.label}
                      </h3>
                      {!expanded && (
                        <span className="shrink-0 rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-text-muted dark:bg-white/10">
                          {count}
                        </span>
                      )}
                    </button>
                    {onAddInSection && group.sectionId !== undefined ? (
                      <button
                        type="button"
                        onClick={() => onAddInSection(group.sectionId ?? null)}
                        className="shrink-0 px-1 text-xs font-medium text-accent hover:underline"
                      >
                        Add
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <Collapse open={!group.label || expanded}>
                  {group.tasks.map((task) => renderTaskNode(task, 0))}
                </Collapse>
              </section>
            )
          })}
          {hasMoreRoots && (
            <button
              type="button"
              onClick={() => setVisibleRootCount((n) => n + TASK_LIST_PAGE_SIZE)}
              className="w-full px-4 py-3 text-center text-sm font-medium text-accent hover:bg-accent/5"
            >
              Show more ({rootTasks.length - visibleRootCount} remaining)
            </button>
          )}
        </div>
      ) : (
        <>
          {visibleRootTasks.map((task) => renderTaskNode(task, 0))}
          {hasMoreRoots && (
            <button
              type="button"
              onClick={() => setVisibleRootCount((n) => n + TASK_LIST_PAGE_SIZE)}
              className="w-full px-4 py-3 text-center text-sm font-medium text-accent hover:bg-accent/5"
            >
              Show more ({rootTasks.length - visibleRootCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  )
}
