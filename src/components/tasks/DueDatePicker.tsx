import { combineLocalDateTime, toDateInputValue, toTimeInputValue } from '@/lib/formatDueDate'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { TimeSelect } from '@/components/tasks/TimeSelect'

interface DueDatePickerProps {
  value: string | null
  onChange: (value: string | null) => void
  allDay?: boolean
}

/** Low-level date/time inputs. Prefer DateTimeReminderField in the detail panel. */
export function DueDatePicker({ value, onChange, allDay = false }: DueDatePickerProps) {
  const { timeFormat } = useTimeFormat()
  const date = toDateInputValue(value)
  const time = toTimeInputValue(value) || '09:00'

  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => {
          if (!e.target.value) {
            onChange(null)
            return
          }
          onChange(combineLocalDateTime(e.target.value, allDay ? null : time, allDay))
        }}
        className="min-w-0 flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
      />
      {!allDay && (
        <TimeSelect
          value={time}
          disabled={!date}
          onChange={(next) => {
            if (!date) return
            onChange(combineLocalDateTime(date, next, false))
          }}
          timeFormat={timeFormat}
        />
      )}
    </div>
  )
}
