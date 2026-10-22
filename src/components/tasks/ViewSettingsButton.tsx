import { useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import {
  TASK_SORT_OPTIONS,
  type TaskGroupBy,
  type TaskSortMode,
} from '@shared/filters'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'

interface ViewSettingsButtonProps {
  sort: TaskSortMode
  onSortChange: (sort: TaskSortMode) => void
  showSort: boolean
  showCompleted: boolean
  onShowCompletedChange: (show: boolean) => void
  showCompletedToggle: boolean
  groupBy: TaskGroupBy
  onGroupByChange: (groupBy: TaskGroupBy) => void
  groupByOptions: { value: TaskGroupBy; label: string }[]
}

export function ViewSettingsButton({
  sort,
  onSortChange,
  showSort,
  showCompleted,
  onShowCompletedChange,
  showCompletedToggle,
  groupBy,
  onGroupByChange,
  groupByOptions,
}: ViewSettingsButtonProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="View settings"
        title="View settings"
        className={[
          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
          open
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-border text-text-muted hover:border-accent/40 hover:text-text-primary',
        ].join(' ')}
      >
        <SlidersHorizontal className="size-3.5" />
        View
      </button>

      <AnchoredPopover
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={260}
        className="rounded-lg border border-border bg-bg-primary p-3 shadow-xl"
      >
        <div className="space-y-3">
          {showCompletedToggle && (
            <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-text-primary">
              <span>Show completed</span>
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => onShowCompletedChange(e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
            </label>
          )}

          {showSort && (
            <label className="block text-sm text-text-primary">
              <span className="mb-1 block text-text-muted">Sort by</span>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value as TaskSortMode)}
                className="w-full rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              >
                {TASK_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm text-text-primary">
            <span className="mb-1 block text-text-muted">Group by</span>
            <select
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as TaskGroupBy)}
              className="w-full rounded-lg border border-border bg-bg-primary px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
            >
              {groupByOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </AnchoredPopover>
    </>
  )
}
