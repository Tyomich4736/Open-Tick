import { useWeekStartsOn } from '@/hooks/useWeekStartsOn'
import {
  hourOptions,
  useCalendarVisibleHours,
} from '@/hooks/useCalendarVisibleHours'
import { useCalendarShowAllRecurrence } from '@/hooks/useCalendarShowAllRecurrence'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { formatHourLabel } from '@/lib/calendarUtils'

export function CalendarSettings() {
  const { weekStartsOn, setWeekStartsOn } = useWeekStartsOn()
  const { startHour, endHour, setStartHour, setEndHour } = useCalendarVisibleHours()
  const { showAllRecurrence, setShowAllRecurrence } = useCalendarShowAllRecurrence()
  const { timeFormat } = useTimeFormat()

  const startOptions = hourOptions(0, 23)
  const endOptions = hourOptions(1, 24)

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <h3 className="font-medium text-text-primary">Week</h3>
        <p className="mt-1 text-sm text-text-muted">First day of the week in month and week views</p>
        <fieldset className="mt-3">
          <legend className="sr-only">Week starts on</legend>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { value: 1 as const, label: 'Monday' },
                { value: 0 as const, label: 'Sunday' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setWeekStartsOn(opt.value)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  weekStartsOn === opt.value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-text-muted hover:border-accent/40',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div>
        <h3 className="font-medium text-text-primary">Recurring tasks</h3>
        <p className="mt-1 text-sm text-text-muted">
          How repeating tasks appear across month, week, day, and agenda views
        </p>
        <label className="mt-4 flex cursor-pointer items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-text-primary">Show all iterations</div>
            <p className="mt-0.5 text-xs text-text-muted">
              Paint every future cycle of a repeating task in the visible range, not only the next
              occurrence
            </p>
          </div>
          <input
            type="checkbox"
            checked={showAllRecurrence}
            onChange={(e) => setShowAllRecurrence(e.target.checked)}
            className="mt-1 size-4 accent-[var(--color-accent)]"
          />
        </label>
      </div>

      <div>
        <h3 className="font-medium text-text-primary">Visible hours</h3>
        <p className="mt-1 text-sm text-text-muted">
          Timed grid in week, days, and day views (e.g. 08:00–22:00)
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm text-text-primary">
            From
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {startOptions
                .filter((h) => h < endHour)
                .map((h) => (
                  <option key={h} value={h}>
                    {formatHourLabel(h, timeFormat)}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm text-text-primary">
            To
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {endOptions
                .filter((h) => h > startHour)
                .map((h) => (
                  <option key={h} value={h}>
                    {h === 24
                      ? timeFormat === '24h'
                        ? '24:00'
                        : '12:00 AM'
                      : formatHourLabel(h, timeFormat)}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  )
}
