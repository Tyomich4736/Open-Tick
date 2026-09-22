import { Plus, X } from 'lucide-react'
import type { ReminderInput } from '@shared/recurrence'
import { MAX_REMINDERS, REMINDER_PRESETS, reminderLabel } from '@shared/recurrence'

interface RemindersEditorProps {
  value: ReminderInput[]
  onChange: (value: ReminderInput[]) => void
  /** Show end-time option when task has start + due (duration) */
  hasDuration?: boolean
  /** When false, show a hint that reminders need a due date to fire */
  hasDueDate?: boolean
}

export function RemindersEditor({
  value,
  onChange,
  hasDuration,
  hasDueDate = true,
}: RemindersEditorProps) {
  const available = REMINDER_PRESETS.filter(
    (preset) =>
      !value.some((r) => r.kind === preset.kind && r.offset_minutes === preset.offset_minutes),
  )
  const quickPresets = available.slice(0, 4)
  const morePresets = available.slice(4)

  const addPreset = (preset: (typeof REMINDER_PRESETS)[number]) => {
    if (value.length >= MAX_REMINDERS) return
    onChange([...value, { kind: preset.kind, offset_minutes: preset.offset_minutes }])
  }

  const addEndReminder = () => {
    if (value.length >= MAX_REMINDERS) return
    if (value.some((r) => r.kind === 'at_due' && r.offset_minutes === 0)) return
    onChange([...value, { kind: 'at_due', offset_minutes: 0 }])
  }

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-text-muted">No reminders</p>
      )}
      {!hasDueDate && value.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Set a due date so reminders can notify you
        </p>
      )}
      <ul className="space-y-1">
        {value.map((reminder, index) => (
          <li
            key={`${reminder.kind}-${reminder.offset_minutes}-${index}`}
            className="flex items-center justify-between rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm"
          >
            <span>{reminderLabel(reminder)}</span>
            <button
              type="button"
              onClick={() => removeAt(index)}
              className="rounded p-0.5 text-text-muted hover:text-priority-high"
              aria-label="Remove reminder"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      {value.length < MAX_REMINDERS && (
        <div className="flex flex-wrap gap-1">
          {quickPresets.map((preset) => (
            <button
              key={`${preset.kind}-${preset.offset_minutes}`}
              type="button"
              onClick={() => addPreset(preset)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-accent hover:text-accent"
            >
              <Plus className="size-3" />
              {preset.label}
            </button>
          ))}
          {morePresets.length > 0 && (
            <select
              className="rounded-md border border-border bg-bg-primary px-2 py-1 text-xs outline-none focus:border-accent"
              value=""
              onChange={(e) => {
                const preset = morePresets.find(
                  (p) => `${p.kind}:${p.offset_minutes}` === e.target.value,
                )
                if (preset) addPreset(preset)
                e.target.value = ''
              }}
            >
              <option value="">More…</option>
              {morePresets.map((preset) => (
                <option
                  key={`${preset.kind}-${preset.offset_minutes}`}
                  value={`${preset.kind}:${preset.offset_minutes}`}
                >
                  {preset.label}
                </option>
              ))}
            </select>
          )}
          {hasDuration && !value.some((r) => r.kind === 'at_due') && (
            <button
              type="button"
              onClick={addEndReminder}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-accent hover:text-accent"
            >
              <Plus className="size-3" />
              At end time
            </button>
          )}
        </div>
      )}
      {value.length >= MAX_REMINDERS && (
        <p className="text-xs text-text-muted">Maximum {MAX_REMINDERS} reminders</p>
      )}
    </div>
  )
}
