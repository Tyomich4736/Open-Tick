import { useRef, useState, type DragEvent, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { TaskListItem } from '@shared/entities'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import {
  adjustAdjacentReorderPosition,
  hitTestDropPosition,
  persistTaskDropPlan,
  planRowDrop,
  planSectionDrop,
  type DropIndicator,
  type DropPosition,
  type TaskDropPlan,
} from '@/lib/taskListDnD'
import { isDescendant } from '@/lib/taskTree'
import {
  applyTaskParentMoveInCaches,
  invalidateTaskQueries,
  suppressTaskInvalidation,
} from '@/lib/taskQueryCache'
import { useUiStore } from '@/stores/uiStore'

interface UseTaskListDnDOptions {
  allowReorder: boolean
  listRef: RefObject<HTMLDivElement | null>
  rootTasks: TaskListItem[]
  parentById: Map<string, string | null>
  getChildren: (parentId: string) => TaskListItem[]
  setLocalRootOrder: (order: string[] | null) => void
  sectionMode?: boolean
}

function findTask(
  taskId: string,
  roots: TaskListItem[],
  getChildren: (parentId: string) => TaskListItem[],
): TaskListItem | null {
  const queue = [...roots]
  const seen = new Set<string>()
  while (queue.length) {
    const task = queue.shift()!
    if (seen.has(task.id)) continue
    seen.add(task.id)
    if (task.id === taskId) return task
    queue.push(...getChildren(task.id))
  }
  return null
}

export function useTaskListDnD({
  allowReorder,
  listRef,
  rootTasks,
  parentById,
  getChildren,
  setLocalRootOrder,
  sectionMode = false,
}: UseTaskListDnDOptions) {
  const queryClient = useQueryClient()
  const { reorderTasks, updateTask } = useTaskMutations()
  const setTaskExpanded = useUiStore((s) => s.setTaskExpanded)
  const [dragId, setDragIdState] = useState<string | null>(null)
  const dragIdRef = useRef<string | null>(null)
  const dragEpochRef = useRef(0)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const suppressClickRef = useRef(false)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  dropIndicatorRef.current = dropIndicator

  function clearDragState() {
    setDragIdState(null)
    setDropIndicator(null)
    const epoch = dragEpochRef.current
    // Defer clearing the ref so a late drop can still read it, and so a
    // trailing click after dragend is still suppressed. Epoch guard prevents
    // an older timeout from wiping a drag that already started.
    window.setTimeout(() => {
      if (dragEpochRef.current !== epoch) return
      dragIdRef.current = null
      suppressClickRef.current = false
    }, 0)
  }

  function beginRowDrag(taskId: string, dataTransfer: DataTransfer) {
    // Shift-click leaves a DOM text selection; Chromium then drags text instead
    // of the row, so the first real task drag fails (especially with multi-select).
    window.getSelection()?.removeAllRanges()

    dragEpochRef.current += 1
    suppressClickRef.current = true
    dragIdRef.current = taskId
    setDragIdState(taskId)
    dataTransfer.effectAllowed = 'move'
    dataTransfer.setData('text/plain', taskId)
  }

  function sectionIdOf(taskId: string): string | null {
    return findTask(taskId, rootTasks, getChildren)?.section_id ?? null
  }

  function sectionMeta(sectionId: string | null): {
    section_id: string | null
    section_name: string | null
    section_sort: number | null
  } {
    const peer = rootTasks.find((t) => (t.section_id ?? null) === sectionId)
    return {
      section_id: sectionId,
      section_name: peer?.section_name ?? null,
      section_sort: peer?.section_sort ?? null,
    }
  }

  function persistMove(
    movingId: string,
    input: { parent_id?: string | null; section_id?: string | null },
  ) {
    updateTask.mutate(
      { id: movingId, input },
      {
        onSuccess: () => {
          window.setTimeout(() => {
            void invalidateTaskQueries(queryClient, { taskId: movingId })
          }, 350)
        },
        onError: () => {
          void invalidateTaskQueries(queryClient)
        },
      },
    )
  }

  function applyPlan(plan: TaskDropPlan) {
    if (plan.type === 'noop') {
      clearDragState()
      return
    }

    const moving = findTask(plan.movingId, rootTasks, getChildren)
    if (!moving) {
      clearDragState()
      return
    }

    if (plan.type === 'nest') {
      applyTaskParentMoveInCaches(queryClient, {
        task: moving,
        fromParentId: plan.fromParentId,
        toParentId: plan.toParentId,
      })
      if (plan.fromParentId === null) {
        setLocalRootOrder(rootTasks.map((t) => t.id).filter((id) => id !== plan.movingId))
      }
      suppressTaskInvalidation(300)
      persistTaskDropPlan(plan, {
        reorder: (ids) => reorderTasks.mutate(ids),
        update: (id, input) => persistMove(id, input),
      })
      setTaskExpanded(plan.toParentId, true)
      clearDragState()
      return
    }

    // relocate
    const parentChanged = plan.fromParentId !== plan.toParentId
    const sectionChanged = plan.sectionId !== undefined

    if (parentChanged || sectionChanged) {
      applyTaskParentMoveInCaches(queryClient, {
        task: moving,
        fromParentId: plan.fromParentId,
        toParentId: plan.toParentId,
        section: sectionChanged ? sectionMeta(plan.sectionId ?? null) : undefined,
      })
    }

    if (plan.toParentId === null) {
      setLocalRootOrder(plan.siblingOrder)
    }

    suppressTaskInvalidation(300)

    persistTaskDropPlan(plan, {
      reorder: (ids) => reorderTasks.mutate(ids),
      update: (id, input) => persistMove(id, input),
    })

    clearDragState()
  }

  function commitDrop(targetId: string, position: DropPosition, dragTaskId?: string | null) {
    const movingId = dragTaskId || dragIdRef.current
    if (!movingId) {
      clearDragState()
      return
    }

    const fromParentId = parentById.get(movingId) ?? null
    const targetParentId = parentById.get(targetId) ?? null
    const targetSectionId = sectionMode ? sectionIdOf(targetId) : undefined
    const dragSectionId = sectionMode ? sectionIdOf(movingId) : undefined
    const crossSection =
      sectionMode &&
      targetSectionId !== undefined &&
      (dragSectionId ?? null) !== (targetSectionId ?? null)

    applyPlan(
      planRowDrop({
        movingId,
        targetId,
        position,
        crossSection,
        sectionId: targetSectionId,
        fromParentId,
        targetParentId,
        rootIds: rootTasks.map((t) => t.id),
        getChildIds: (parentId) => getChildren(parentId).map((t) => t.id),
        parentById,
      }),
    )
  }

  function commitDropToSection(sectionId: string | null, dragTaskId?: string | null) {
    const movingId = dragTaskId || dragIdRef.current
    if (!movingId || !sectionMode) {
      clearDragState()
      return
    }

    applyPlan(
      planSectionDrop({
        movingId,
        sectionId,
        fromParentId: parentById.get(movingId) ?? null,
        fromSectionId: sectionIdOf(movingId),
        rootIds: rootTasks.map((t) => t.id),
        sectionIdOf,
      }),
    )
  }

  function onRowDragOver(e: DragEvent, taskId: string) {
    const movingId = dragIdRef.current
    if (!allowReorder || !movingId || movingId === taskId) return
    if (isDescendant(taskId, movingId, parentById)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const scrollParent = listRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (scrollParent) {
      const rect = scrollParent.getBoundingClientRect()
      const edge = 48
      if (e.clientY < rect.top + edge) scrollParent.scrollTop -= 12
      else if (e.clientY > rect.bottom - edge) scrollParent.scrollTop += 12
    }

    const rowRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const yRatio = (e.clientY - rowRect.top) / rowRect.height

    const crossSection =
      sectionMode && (sectionIdOf(movingId) ?? null) !== (sectionIdOf(taskId) ?? null)
    let position = hitTestDropPosition(yRatio, crossSection)

    const fromParentId = parentById.get(movingId) ?? null
    const targetParentId = parentById.get(taskId) ?? null
    if (!crossSection && fromParentId === targetParentId) {
      const siblingIds =
        targetParentId === null
          ? rootTasks.map((t) => t.id)
          : getChildren(targetParentId).map((t) => t.id)
      position = adjustAdjacentReorderPosition({
        position,
        movingId,
        targetId: taskId,
        siblingIds,
      })
    }

    setDropIndicator((prev) =>
      prev?.targetId === taskId && prev.position === position
        ? prev
        : { targetId: taskId, position },
    )
  }

  function onSectionDragOver(e: DragEvent) {
    if (!allowReorder || !sectionMode || !dragIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function rowDropHighlight(taskId: string): DropPosition | null {
    if (dropIndicator?.targetId !== taskId) return null
    return dropIndicator.position
  }

  return {
    dragId,
    dragIdRef,
    beginRowDrag,
    dropIndicator,
    setDropIndicator,
    dropIndicatorRef,
    suppressClickRef,
    clearDragState,
    commitDrop,
    commitDropToSection,
    onRowDragOver,
    onSectionDragOver,
    rowDropHighlight,
  }
}
