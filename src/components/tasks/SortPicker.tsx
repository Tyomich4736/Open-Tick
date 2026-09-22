import { ArrowUpDown, Check } from 'lucide-react'
import { TASK_SORT_OPTIONS, type TaskSortMode } from '@shared/filters'

interface SortPickerProps {
  value: TaskSortMode
  onChange: (sort: TaskSortMode) => void
  disabled?: boolean
}

export function SortPicker({ value, onChange, disabled }: SortPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="size-3.5 text-text-muted" aria-hidden />
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TaskSortMode)}
        className="rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
        aria-label="Sort tasks"
      >
        {TASK_SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface ShowCompletedToggleProps {
  checked: boolean
  onChange: (show: boolean) => void
}

export function ShowCompletedToggle({ checked, onChange }: ShowCompletedToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors',
        checked
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-border text-text-muted hover:border-accent/40 hover:text-text-primary',
      ].join(' ')}
      aria-pressed={checked}
    >
      <Check className="size-3.5" />
      Completed
    </button>
  )
}
