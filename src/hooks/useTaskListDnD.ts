import { useRef, useState, type DragEvent, type RefObject } from 'react'
import type { TaskListItem } from '@shared/entities'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import {
  isDescendant,
  reorderSiblingIds,
  type DropIndicator,
  type DropPosition,
} from '@/lib/taskTree'
import { useUiStore } from '@/stores/uiStore'

interface UseTaskListDnDOptions {
  allowReorder: boolean
  listRef: RefObject<HTMLDivElement | null>
  rootTasks: TaskListItem[]
  parentById: Map<string, string | null>
  getChildren: (parentId: string) => TaskListItem[]
  expandedTaskIds: Record<string, boolean>
  setLocalRootOrder: (order: string[] | null) => void
}

export function useTaskListDnD({
  allowReorder,
  listRef,
  rootTasks,
  parentById,
  getChildren,
  expandedTaskIds,
  setLocalRootOrder,
}: UseTaskListDnDOptions) {
  const { reorderTasks, updateTask } = useTaskMutations()
  const setTaskExpanded = useUiStore((s) => s.setTaskExpanded)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)
  const suppressClickRef = useRef(false)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)
  dropIndicatorRef.current = dropIndicator

  function clearDragState() {
    setDragId(null)
    setDropIndicator(null)
  }

  function commitDrop(targetId: string, position: DropPosition) {
    if (!dragId || dragId === targetId) {
      clearDragState()
      return
    }

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
      if (expandedTaskIds[targetId] === false) {
        setTaskExpanded(targetId, true)
      }
      clearDragState()
      return
    }

    const newParentId = targetParent
    const siblings =
      newParentId === null
        ? rootTasks.map((t) => t.id)
        : getChildren(newParentId).map((t) => t.id)

    let insertAt = siblings.indexOf(targetId)
    if (insertAt < 0) insertAt = siblings.length
    if (position === 'after') insertAt += 1

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

  function onRowDragOver(e: DragEvent, taskId: string) {
    if (!allowReorder || !dragId || dragId === taskId) return
    if (isDescendant(taskId, dragId, parentById)) return

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

  function rowDropHighlight(taskId: string): DropPosition | null {
    if (dropIndicator?.targetId !== taskId) return null
    return dropIndicator.position
  }

  return {
    dragId,
    setDragId,
    dropIndicator,
    setDropIndicator,
    dropIndicatorRef,
    suppressClickRef,
    clearDragState,
    commitDrop,
    onRowDragOver,
    rowDropHighlight,
  }
}
