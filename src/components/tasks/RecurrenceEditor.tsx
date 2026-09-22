import type { RecurrenceFrequency, RecurrenceRule } from '@shared/recurrence'
import { defaultRecurrence, recurrenceLabel } from '@shared/recurrence'
import { dateInputToIso, toDateInputValue } from '@/lib/formatDueDate'

interface RecurrenceEditorProps {
  value: RecurrenceRule | null
  onChange: (value: RecurrenceRule | null) => void
}

const PRESETS: { label: string; frequency: RecurrenceFrequency | null }[] = [
  { label: 'Does not repeat', frequency: null },
  { label: 'Every day', frequency: 'daily' },
  { label: 'Every week', frequency: 'weekly' },
  { label: 'Every month', frequency: 'monthly' },
  { label: 'Every year', frequency: 'yearly' },
]

const WEEKDAYS = [
  { value: 0, label: 'S' },
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
]

export function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps) {
  const presetValue = value
    ? PRESETS.find((p) => p.frequency === value.frequency && value.interval === 1)?.frequency ??
      'custom'
    : 'none'

  return (
    <div className="space-y-3">
      <select
        value={presetValue === 'custom' ? value!.frequency : presetValue === 'none' ? '' : presetValue}
        onChange={(e) => {
          const freq = e.target.value as RecurrenceFrequency | ''
          if (!freq) {
            onChange(null)
            return
          }
          onChange(value && value.frequency === freq ? value : defaultRecurrence(freq))
        }}
        className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
      >
        {PRESETS.map((p) => (
          <option key={p.label} value={p.frequency ?? ''}>
            {p.label}
          </option>
        ))}
      </select>

      {value && (
        <>
          <p className="text-xs text-text-muted">{recurrenceLabel(value)}</p>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-text-muted">
              Every
              <input
                type="number"
                min={1}
                max={99}
                value={value.interval}
                onChange={(e) =>
                  onChange({ ...value, interval: Math.max(1, Number(e.target.value) || 1) })
                }
                className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm outline-none focus:border-accent"
              />
            </label>
            <label className="text-xs text-text-muted">
              Based on
              <select
                value={value.anchor}
                onChange={(e) =>
                  onChange({
                    ...value,
                    anchor: e.target.value as RecurrenceRule['anchor'],
                  })
                }
                className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm outline-none focus:border-accent"
              >
                <option value="due_date">Due date</option>
                <option value="completion">Completion</option>
              </select>
            </label>
          </div>

          {value.frequency === 'weekly' && (
            <div className="flex gap-1">
              {WEEKDAYS.map((day) => {
                const active = (value.weekdays ?? []).includes(day.value)
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const current = new Set(value.weekdays ?? [])
                      if (current.has(day.value)) current.delete(day.value)
                      else current.add(day.value)
                      const weekdays = [...current].sort()
                      onChange({
                        ...value,
                        weekdays: weekdays.length ? weekdays : [new Date().getDay()],
                      })
                    }}
                    className={`size-7 rounded-full text-xs font-medium ${
                      active
                        ? 'bg-accent text-white'
                        : 'border border-border text-text-muted hover:border-accent'
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          )}

          <label className="block text-xs text-text-muted">
            Ends
            <select
              value={value.end.type}
              onChange={(e) => {
                const type = e.target.value as RecurrenceRule['end']['type']
                if (type === 'never') onChange({ ...value, end: { type: 'never' } })
                else if (type === 'on_date')
                  onChange({
                    ...value,
                    end: { type: 'on_date', date: new Date().toISOString() },
                  })
                else onChange({ ...value, end: { type: 'after_count', count: 10 } })
              }}
              className="mt-1 w-full rounded-lg border border-border bg-bg-primary px-3 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="never">Never</option>
              <option value="on_date">On date</option>
              <option value="after_count">After N times</option>
            </select>
          </label>

          {value.end.type === 'on_date' && (
            <input
              type="date"
              value={toDateInputValue(value.end.date)}
              onChange={(e) => {
                const iso = dateInputToIso(e.target.value)
                if (iso) onChange({ ...value, end: { type: 'on_date', date: iso } })
              }}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
            />
          )}

          {value.end.type === 'after_count' && (
            <input
              type="number"
              min={1}
              max={999}
              value={value.end.count}
              onChange={(e) =>
                onChange({
                  ...value,
                  end: { type: 'after_count', count: Math.max(1, Number(e.target.value) || 1) },
                })
              }
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
            />
          )}
        </>
      )}
    </div>
  )
}
