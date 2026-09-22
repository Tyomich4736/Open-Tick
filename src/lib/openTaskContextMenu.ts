import type { MouseEvent } from 'react'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { useUiStore } from '@/stores/uiStore'

/** Open the shared task / bulk context menu (same as list right-click). */
export function openTaskContextMenu(e: MouseEvent, taskId: string) {
  e.preventDefault()
  e.stopPropagation()
  const selectedIds = useTaskSelectionStore.getState().selectedIds
  const multi = selectedIds.length >= 2 && selectedIds.includes(taskId)
  if (!multi) {
    useTaskSelectionStore.getState().selectOne(taskId)
  }
  useUiStore.getState().setContextMenu({
    type: 'task',
    id: taskId,
    x: e.clientX,
    y: e.clientY,
  })
}
