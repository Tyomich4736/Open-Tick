import { useMemo, useRef, useState } from 'react'
import { Bell, Calendar } from 'lucide-react'
import type { ReminderInput } from '@shared/recurrence'
import { ensureAtDueReminder, reminderLabel } from '@shared/recurrence'
import { CalendarPicker } from '@/components/tasks/CalendarPicker'
import { RemindersEditor } from '@/components/tasks/RemindersEditor'
import { TimeSelect } from '@/components/tasks/TimeSelect'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import {
  combineLocalDateTime,
  formatScheduleLabel,
  isDateOnlySchedule,
  isDurationSchedule,
  presetDueIso,
  toDateInputValue,
  toTimeInputValue,
} from '@/lib/formatDueDate'

export interface ScheduleValue {
  due_date: string | null
  start_date: string | null
  is_all_day: boolean
  reminders: ReminderInput[]
}

interface DateTimeReminderFieldProps {
  value: ScheduleValue
  onChange: (value: ScheduleValue) => void
  /** Pill chip trigger matching ProjectPickerChip */
  chip?: boolean
}

const chipTriggerClass =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-bg-primary px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-text-primary'

const fieldTriggerClass =
  'flex w-full items-center gap-2 rounded-lg border border-border bg-bg-primary px-2.5 py-2 text-left text-sm transition-colors hover:border-accent/40'

type PickerMode = 'time' | 'duration'

const POPOVER_WIDTH = 236

export function DateTimeReminderField({ value, onChange, chip }: DateTimeReminderFieldProps) {
  const [open, setOpen] = useState(false)
  /** Which all-day date the calendar edits (TickTick-style from/to). */
  const [allDayEdit, setAllDayEdit] = useState<'start' | 'end'>('start')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { timeFormat } = useTimeFormat()

  const mode: PickerMode = isDurationSchedule(
    value.start_date,
    value.due_date,
    value.is_all_day,
  )
    ? 'duration'
    : 'time'

  const dateOnly = isDateOnlySchedule(value)
  const hideTimeControls = mode === 'duration' ? value.is_all_day : dateOnly

  const rangeError = useMemo(() => {
    if (!value.start_date || !value.due_date || value.is_all_day) return null
    try {
      if (new Date(value.start_date).getTime() > new Date(value.due_date).getTime()) {
        return 'End must be on or after start'
      }
    } catch {
      return null
    }
    return null
  }, [value.start_date, value.due_date, value.is_all_day])

  const label = formatScheduleLabel(
    {
      due_date: value.due_date,
      start_date: value.start_date,
      is_all_day: value.is_all_day,
    },
    timeFormat,
  )
  const reminderSummary =
    value.reminders.length === 0
      ? null
      : value.reminders.length === 1
        ? reminderLabel(value.reminders[0])
        : `${value.reminders.length} reminders`

  const todayStr = toDateInputValue(new Date().toISOString())

  /** Shared calendar day for timed duration (end stays on start's day). */
  const durationDateStr =
    toDateInputValue(value.start_date) || toDateInputValue(value.due_date) || todayStr

  const allDayStartStr = toDateInputValue(value.start_date) || durationDateStr
  const allDayEndStr = toDateInputValue(value.due_date) || allDayStartStr

  const setMode = (next: PickerMode) => {
    if (next === 'time') {
      // Duration → Time: drop start. All-day event becomes date-only ("No time").
      const dateStr = toDateInputValue(value.due_date) || todayStr
      if (value.is_all_day) {
        onChange({
          ...value,
          is_all_day: false,
          start_date: null,
          due_date: combineLocalDateTime(dateStr, null, false),
        })
        return
      }
      onChange({ ...value, start_date: null })
      return
    }
    const dateStr = toDateInputValue(value.due_date) || todayStr
    if (dateOnly || value.is_all_day) {
      // Date-only → same-day all-day event
      onChange({
        ...value,
        is_all_day: true,
        start_date: combineLocalDateTime(dateStr, null, true),
        due_date: combineLocalDateTime(dateStr, null, true),
      })
      return
    }
    const endTime = toTimeInputValue(value.due_date) || '10:00'
    const [h, m] = endTime.split(':').map(Number)
    const startH = h === 0 && m === 0 ? 0 : Math.max(0, h - 1)
    const startTime = `${String(startH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    onChange({
      ...value,
      is_all_day: false,
      start_date: combineLocalDateTime(dateStr, startTime, false),
      due_date: combineLocalDateTime(dateStr, endTime, false),
      reminders: ensureAtDueReminder(value.reminders),
    })
  }

  const setPointDate = (dateStr: string) => {
    const time = dateOnly ? null : toTimeInputValue(value.due_date) || '09:00'
    onChange({
      ...value,
      is_all_day: false,
      start_date: null,
      due_date: combineLocalDateTime(dateStr, time, false),
      reminders: dateOnly ? value.reminders : ensureAtDueReminder(value.reminders),
    })
  }

  const setTimedDurationDate = (dateStr: string) => {
    const startTime = toTimeInputValue(value.start_date) || '09:00'
    const endTime = toTimeInputValue(value.due_date) || '10:00'
    onChange({
      ...value,
      start_date: combineLocalDateTime(dateStr, startTime, false),
      due_date: combineLocalDateTime(dateStr, endTime, false),
      reminders: ensureAtDueReminder(value.reminders),
    })
  }

  const setAllDayStartDate = (dateStr: string) => {
    let endStr = allDayEndStr
    if (endStr < dateStr) endStr = dateStr
    onChange({
      ...value,
      is_all_day: true,
      start_date: combineLocalDateTime(dateStr, null, true),
      due_date: combineLocalDateTime(endStr, null, true),
    })
  }

  const setAllDayEndDate = (dateStr: string) => {
    let startStr = allDayStartStr
    if (dateStr < startStr) startStr = dateStr
    onChange({
      ...value,
      is_all_day: true,
      start_date: combineLocalDateTime(startStr, null, true),
      due_date: combineLocalDateTime(dateStr, null, true),
    })
  }

  const setDueTime = (timeStr: string) => {
    if (mode === 'duration') {
      onChange({
        ...value,
        is_all_day: false,
        due_date: combineLocalDateTime(durationDateStr, timeStr, false),
        reminders: ensureAtDueReminder(value.reminders),
      })
      return
    }
    const dateStr = toDateInputValue(value.due_date) || todayStr
    onChange({
      ...value,
      is_all_day: false,
      start_date: null,
      due_date: combineLocalDateTime(dateStr, timeStr, false),
      reminders: ensureAtDueReminder(value.reminders),
    })
  }

  const setStartTime = (timeStr: string) => {
    onChange({
      ...value,
      is_all_day: false,
      start_date: combineLocalDateTime(durationDateStr, timeStr, false),
      // Keep end on the same day
      due_date: value.due_date
        ? combineLocalDateTime(
            durationDateStr,
            toTimeInputValue(value.due_date) || '10:00',
            false,
          )
        : combineLocalDateTime(durationDateStr, '10:00', false),
      reminders: ensureAtDueReminder(value.reminders),
    })
  }

  /** Duration "All day" — TickTick all-day event (is_all_day + start + due). */
  const setAllDay = (enabled: boolean) => {
    const leaving = value.is_all_day && !enabled
    onChange({
      ...value,
      is_all_day: enabled,
      start_date: combineLocalDateTime(
        allDayStartStr || durationDateStr,
        enabled ? null : leaving ? '09:00' : toTimeInputValue(value.start_date) || '09:00',
        enabled,
      ),
      due_date: combineLocalDateTime(
        allDayEndStr || durationDateStr,
        enabled ? null : leaving ? '10:00' : toTimeInputValue(value.due_date) || '10:00',
        enabled,
      ),
      reminders: enabled ? value.reminders : ensureAtDueReminder(value.reminders),
    })
  }

  /** Time "No time" — date only, not TickTick all-day (is_all_day false, noon anchor). */
  const setNoTime = (enabled: boolean) => {
    const dueDate = toDateInputValue(value.due_date) || (enabled ? todayStr : '')
    onChange({
      ...value,
      is_all_day: false,
      start_date: null,
      due_date: dueDate
        ? combineLocalDateTime(
            dueDate,
            enabled ? null : dateOnly ? '09:00' : toTimeInputValue(value.due_date) || '09:00',
            false,
          )
        : value.due_date,
      reminders: enabled ? value.reminders : ensureAtDueReminder(value.reminders),
    })
  }

  const applyPreset = (preset: 'today' | 'tomorrow' | 'next_week') => {
    const dateStr = toDateInputValue(presetDueIso(preset, true))
    if (mode === 'duration') {
      if (value.is_all_day) {
        onChange({
          ...value,
          start_date: combineLocalDateTime(dateStr, null, true),
          due_date: combineLocalDateTime(dateStr, null, true),
        })
        return
      }
      const startTime = toTimeInputValue(value.start_date) || '09:00'
      const endTime = toTimeInputValue(value.due_date) || '10:00'
      onChange({
        ...value,
        start_date: combineLocalDateTime(dateStr, startTime, false),
        due_date: combineLocalDateTime(dateStr, endTime, false),
      })
      return
    }
    // Time tab presets: keep date-only vs timed
    onChange({
      ...value,
      is_all_day: false,
      start_date: null,
      due_date: combineLocalDateTime(
        dateStr,
        dateOnly ? null : toTimeInputValue(value.due_date) || '09:00',
        false,
      ),
      reminders: dateOnly ? value.reminders : ensureAtDueReminder(value.reminders),
    })
  }

  const clearSchedule = () => {
    onChange({
      due_date: null,
      start_date: null,
      is_all_day: value.is_all_day,
      reminders: [],
    })
  }

  return (
    <div className={chip ? undefined : 'relative min-w-0 flex-1'}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={[chip ? chipTriggerClass : fieldTriggerClass, open && 'border-accent']
          .filter(Boolean)
          .join(' ')}
      >
        <Calendar className={`shrink-0 ${chip ? 'size-3 opacity-70' : 'size-3.5 text-text-muted'}`} />
        <span
          className={[
            'min-w-0 truncate',
            chip ? 'max-w-[12rem]' : 'flex-1',
            value.due_date ? 'text-text-primary' : 'text-text-muted',
          ].join(' ')}
        >
          {label}
        </span>
        {!chip && reminderSummary && (
          <span className="flex max-w-[40%] items-center gap-1 truncate text-xs text-text-muted">
            <Bell className="size-3 shrink-0" />
            {reminderSummary}
          </span>
        )}
        {chip && value.reminders.length > 0 && (
          <Bell className="size-3 shrink-0 text-accent" />
        )}
      </button>

      <AnchoredPopover
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={POPOVER_WIDTH}
        className="w-[236px] rounded-xl border border-border bg-bg-primary p-2.5 shadow-lg"
      >
        <div className="mb-2 flex gap-0.5 rounded-lg border border-border p-0.5">
          {(
            [
              ['time', 'Time'],
              ['duration', 'Duration'],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={[
                'flex-1 rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors',
                mode === key
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:text-text-primary',
              ].join(' ')}
            >
              {text}
            </button>
          ))}
        </div>

        <div className="mb-2 flex flex-wrap gap-1">
          {(
            [
              ['today', 'Today'],
              ['tomorrow', 'Tomorrow'],
              ['next_week', 'Next week'],
            ] as const
          ).map(([key, text]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-text-muted hover:border-accent hover:text-accent"
            >
              {text}
            </button>
          ))}
          <button
            type="button"
            onClick={clearSchedule}
            className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-text-muted hover:border-priority-high hover:text-priority-high"
          >
            Clear
          </button>
        </div>

        {mode === 'duration' && value.is_all_day ? (
          <>
            <div className="mb-2 grid grid-cols-2 gap-1">
              {(
                [
                  ['start', 'From', allDayStartStr],
                  ['end', 'To', allDayEndStr],
                ] as const
              ).map(([key, text, dateStr]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAllDayEdit(key)}
                  className={[
                    'rounded-md border px-1.5 py-1 text-left transition-colors',
                    allDayEdit === key
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-muted hover:border-accent/40',
                  ].join(' ')}
                >
                  <span className="block text-[10px] font-medium opacity-80">{text}</span>
                  <span className="block truncate text-[11px] text-text-primary">
                    {dateStr || 'Set date'}
                  </span>
                </button>
              ))}
            </div>
            <CalendarPicker
              value={allDayEdit === 'start' ? allDayStartStr : allDayEndStr}
              onChange={allDayEdit === 'start' ? setAllDayStartDate : setAllDayEndDate}
            />
          </>
        ) : (
          <CalendarPicker
            value={mode === 'duration' ? durationDateStr : toDateInputValue(value.due_date)}
            onChange={mode === 'duration' ? setTimedDurationDate : setPointDate}
          />
        )}

        {!hideTimeControls &&
          (mode === 'duration' ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block min-w-0">
                <span className="mb-0.5 block text-[10px] font-medium text-text-muted">Start</span>
                <TimeSelect
                  compact
                  value={toTimeInputValue(value.start_date) || '09:00'}
                  onChange={setStartTime}
                  timeFormat={timeFormat}
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-0.5 block text-[10px] font-medium text-text-muted">End</span>
                <TimeSelect
                  compact
                  value={toTimeInputValue(value.due_date) || '10:00'}
                  onChange={setDueTime}
                  timeFormat={timeFormat}
                />
              </label>
            </div>
          ) : (
            <div className="mt-2">
              <TimeSelect
                value={toTimeInputValue(value.due_date) || '09:00'}
                onChange={setDueTime}
                timeFormat={timeFormat}
              />
            </div>
          ))}

        {rangeError && <p className="mt-1.5 text-[11px] text-priority-high">{rangeError}</p>}

        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={mode === 'duration' ? value.is_all_day : dateOnly}
              onChange={(e) =>
                mode === 'duration' ? setAllDay(e.target.checked) : setNoTime(e.target.checked)
              }
              className="rounded border-border"
            />
            {mode === 'duration' ? 'All day' : 'No time'}
          </label>
        </div>

        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Bell className="size-3.5" />
            Reminders
          </div>
          <RemindersEditor
            value={value.reminders}
            onChange={(reminders) => onChange({ ...value, reminders })}
            hasDuration={mode === 'duration' && !value.is_all_day}
            hasDueDate={Boolean(value.due_date)}
          />
        </div>
      </AnchoredPopover>
    </div>
  )
}
