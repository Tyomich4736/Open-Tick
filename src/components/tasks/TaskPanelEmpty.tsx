import { CheckSquare } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'

export function TaskPanelEmpty() {
  const focusQuickAdd = useUiStore((s) => s.focusQuickAdd)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <CheckSquare className="size-7" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary">Select a task to view details</p>
        <p className="mt-1 text-xs text-text-muted">
          Or create one — notes and subtasks live here
        </p>
      </div>
      <button
        type="button"
        onClick={() => focusQuickAdd()}
        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        + Add task
      </button>
    </div>
  )
}
