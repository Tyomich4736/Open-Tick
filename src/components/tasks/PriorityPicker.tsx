import type { Priority } from '@shared/entities'
import { priorityColors, priorityLabels } from '@/lib/priority'

interface PriorityPickerProps {
  value: Priority
  onChange: (value: Priority) => void
  /** Compact icon-only row for the detail panel */
  compact?: boolean
}

const OPTIONS: Priority[] = [0, 1, 3, 5]

export function PriorityPicker({ value, onChange, compact }: PriorityPickerProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1" role="group" aria-label="Priority">
        {OPTIONS.map((priority) => {
          const active = value === priority
          const color = priorityColors[priority]
          return (
            <button
              key={priority}
              type="button"
              title={priorityLabels[priority]}
              aria-label={priorityLabels[priority]}
              aria-pressed={active}
              onClick={() => onChange(priority)}
              className={[
                'flex size-7 items-center justify-center rounded-lg border transition-colors',
                active
                  ? 'border-accent bg-accent/10'
                  : 'border-border hover:border-accent/40',
              ].join(' ')}
            >
              {priority === 0 ? (
                <span className="size-2 rounded-full border border-text-muted/50" />
              ) : (
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((priority) => (
        <button
          key={priority}
          type="button"
          onClick={() => onChange(priority)}
          className={[
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === priority
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-text-muted hover:border-accent/40',
          ].join(' ')}
        >
          <span
            className="mr-1.5 inline-block size-2 rounded-full"
            style={{
              backgroundColor:
                priorityColors[priority] === 'transparent' ? '#ccc' : priorityColors[priority],
            }}
          />
          {priorityLabels[priority]}
        </button>
      ))}
    </div>
  )
}
