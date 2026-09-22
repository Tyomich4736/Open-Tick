import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { useCalendarStore } from '@/stores/calendarStore'

export function TaskDetailPopup() {
  const popupTaskId = useCalendarStore((s) => s.popupTaskId)
  const closeTaskPopup = useCalendarStore((s) => s.closeTaskPopup)

  useEffect(() => {
    if (!popupTaskId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeTaskPopup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [popupTaskId, closeTaskPopup])

  if (!popupTaskId) return null

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeTaskPopup()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
        className="flex max-h-[min(88vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-bg-primary shadow-xl"
      >
        <TaskDetailPanel taskId={popupTaskId} variant="modal" onClose={closeTaskPopup} />
      </div>
    </div>,
    document.body,
  )
}
