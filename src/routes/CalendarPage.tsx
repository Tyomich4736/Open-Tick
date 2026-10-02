import { useCallback, useMemo } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  format,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ViewModeSwitcher } from '@/components/calendar/ViewModeSwitcher'
import { CalendarMonth } from '@/components/calendar/CalendarMonth'
import { CalendarAgenda, parseCursorDate } from '@/components/calendar/CalendarAgenda'
import {
  CalendarTimeGrid,
  type GridCreateRange,
} from '@/components/calendar/CalendarTimeGrid'
import { useTasks } from '@/hooks/useTasks'
import { useInboxProject } from '@/hooks/useProjects'
import { useProjects } from '@/hooks/useProjects'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useWeekStartsOn } from '@/hooks/useWeekStartsOn'
import { useCalendarShowAllRecurrence } from '@/hooks/useCalendarShowAllRecurrence'
import { useCalendarShowCompleted } from '@/hooks/useCalendarShowCompleted'
import {
  agendaRange,
  dayRange,
  monthGridRange,
  multiDayRange,
  rangeToFilterIso,
  weekRange,
} from '@/lib/calendarUtils'
import { expandTasksForCalendarRange } from '@shared/expandRecurrence'
import {
  useCalendarStore,
  DAYS_COUNT_OPTIONS,
  type CalendarMode,
  type DaysCount,
} from '@/stores/calendarStore'

const MODES: { id: CalendarMode; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'days', label: 'Days' },
  { id: 'day', label: 'Day' },
  { id: 'agenda', label: 'Agenda' },
]

export function CalendarPage() {
  const mode = useCalendarStore((s) => s.mode)
  const setMode = useCalendarStore((s) => s.setMode)
  const cursorDate = useCalendarStore((s) => s.cursorDate)
  const setCursorDate = useCalendarStore((s) => s.setCursorDate)
  const daysCount = useCalendarStore((s) => s.daysCount)
  const setDaysCount = useCalendarStore((s) => s.setDaysCount)
  const openTaskPopup = useCalendarStore((s) => s.openTaskPopup)
  const requestFocusTitle = useCalendarStore((s) => s.requestFocusTitle)
  const { weekStartsOn } = useWeekStartsOn()
  const { showAllRecurrence } = useCalendarShowAllRecurrence()
  const { showCompleted } = useCalendarShowCompleted()
  const { data: projects } = useProjects()
  const inbox = useInboxProject(projects)
  const { createTask } = useTaskMutations()

  const cursor = useMemo(() => parseCursorDate(cursorDate), [cursorDate])

  const filterRange = useMemo(() => {
    if (mode === 'month') {
      const { start, end } = monthGridRange(cursor, weekStartsOn)
      return { ...rangeToFilterIso(start, end), start, end }
    }
    if (mode === 'week') {
      const { start, end } = weekRange(cursor, weekStartsOn)
      return { ...rangeToFilterIso(start, end), start, end }
    }
    if (mode === 'days') {
      const { start, end } = multiDayRange(cursor, daysCount)
      return { ...rangeToFilterIso(start, end), start, end }
    }
    if (mode === 'day') {
      const { start, end } = dayRange(cursor)
      return { ...rangeToFilterIso(start, end), start, end }
    }
    const { start, end } = agendaRange(cursor, 30)
    return { ...rangeToFilterIso(start, end), start, end }
  }, [mode, cursor, weekStartsOn, daysCount])

  const { data: rawTasks = [], isLoading } = useTasks({
    due_from: filterRange.due_from,
    due_to: filterRange.due_to,
    include_completed: showCompleted,
    parent_id: null,
    sort: 'due_date',
    include_recurring_series: showAllRecurrence,
  })

  const tasks = useMemo(() => {
    if (!showAllRecurrence) return rawTasks
    return expandTasksForCalendarRange(rawTasks, filterRange.start, filterRange.end)
  }, [showAllRecurrence, rawTasks, filterRange.start, filterRange.end])

  const weekDays = useMemo(() => {
    const { start, end } = weekRange(cursor, weekStartsOn)
    return eachDayOfInterval({ start, end })
  }, [cursor, weekStartsOn])

  const customDays = useMemo(() => {
    const { start, end } = multiDayRange(cursor, daysCount)
    return eachDayOfInterval({ start, end })
  }, [cursor, daysCount])

  const title = useMemo(() => {
    if (mode === 'month') return format(cursor, 'MMMM yyyy')
    if (mode === 'week') {
      const { start, end } = weekRange(cursor, weekStartsOn)
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    }
    if (mode === 'days') {
      const { start, end } = multiDayRange(cursor, daysCount)
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
    }
    if (mode === 'day') return format(cursor, 'EEEE, MMMM d, yyyy')
    return 'Agenda'
  }, [mode, cursor, weekStartsOn, daysCount])

  const goPrev = () => {
    if (mode === 'month') setCursorDate(subMonths(cursor, 1))
    else if (mode === 'week') setCursorDate(subWeeks(cursor, 1))
    else if (mode === 'days') setCursorDate(subDays(cursor, daysCount))
    else if (mode === 'day') setCursorDate(subDays(cursor, 1))
    else setCursorDate(subDays(cursor, 7))
  }

  const goNext = () => {
    if (mode === 'month') setCursorDate(addMonths(cursor, 1))
    else if (mode === 'week') setCursorDate(addWeeks(cursor, 1))
    else if (mode === 'days') setCursorDate(addDays(cursor, daysCount))
    else if (mode === 'day') setCursorDate(addDays(cursor, 1))
    else setCursorDate(addDays(cursor, 7))
  }

  const goToday = () => setCursorDate(new Date())

  const onCreateRange = useCallback(
    (range: GridCreateRange) => {
      if (!inbox?.id) return
      createTask.mutate(
        {
          title: 'New task',
          project_id: inbox.id,
          start_date: range.start_date,
          due_date: range.due_date,
          is_all_day: range.is_all_day,
        },
        {
          onSuccess: (task) => {
            openTaskPopup(task.id)
            requestFocusTitle()
          },
        },
      )
    },
    [inbox?.id, createTask, openTaskPopup, requestFocusTitle],
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg border border-border p-1.5 text-text-muted hover:border-accent/40 hover:text-text-primary"
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-lg border border-border px-2.5 py-1 text-xs text-text-muted hover:border-accent/40 hover:text-text-primary"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg border border-border p-1.5 text-text-muted hover:border-accent/40 hover:text-text-primary"
                aria-label="Next"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <p className="mt-0.5 text-sm text-text-muted">
            Drag on week/day to create a timed task
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'days' && (
            <label className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              Show
              <select
                value={daysCount}
                onChange={(e) => setDaysCount(Number(e.target.value) as DaysCount)}
                className="rounded-lg border border-border bg-bg-primary px-2 py-1.5 text-xs font-medium text-text-primary outline-none focus:border-accent"
                aria-label="Number of days"
              >
                {DAYS_COUNT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="inline-flex gap-0.5 rounded-xl border border-border p-0.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={[
                  'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  mode === m.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-muted hover:text-text-primary',
                ].join(' ')}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ViewModeSwitcher />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {isLoading && tasks.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">Loading…</div>
        ) : mode === 'month' ? (
          <CalendarMonth cursor={cursor} tasks={tasks} weekStartsOn={weekStartsOn} />
        ) : mode === 'week' ? (
          <CalendarTimeGrid days={weekDays} tasks={tasks} onCreateRange={onCreateRange} />
        ) : mode === 'days' ? (
          <CalendarTimeGrid days={customDays} tasks={tasks} onCreateRange={onCreateRange} />
        ) : mode === 'day' ? (
          <CalendarTimeGrid days={[cursor]} tasks={tasks} onCreateRange={onCreateRange} />
        ) : (
          <CalendarAgenda cursor={cursor} tasks={tasks} />
        )}
      </div>
    </div>
  )
}
