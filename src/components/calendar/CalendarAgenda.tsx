import { useMemo } from 'react'
import { addDays, eachDayOfInterval, format, isToday, parseISO } from 'date-fns'
import type { TaskListItem } from '@shared/entities'
import { formatDueRange } from '@/lib/formatDueDate'
import { tasksForDay } from '@/lib/calendarUtils'
import { openTaskContextMenu } from '@/lib/openTaskContextMenu'
import { calendarTaskDotStyle } from '@/lib/theme'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { useCalendarStore } from '@/stores/calendarStore'

interface CalendarAgendaProps {
  cursor: Date
  tasks: TaskListItem[]
  days?: number
}

export function CalendarAgenda({ cursor, tasks, days = 30 }: CalendarAgendaProps) {
  const { timeFormat } = useTimeFormat()
  const openTaskPopup = useCalendarStore((s) => s.openTaskPopup)

  const dayList = useMemo(
    () => eachDayOfInterval({ start: cursor, end: addDays(cursor, days - 1) }),
    [cursor, days],
  )

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        {dayList.map((day) => {
          const dayTasks = tasksForDay(tasks, day)
          if (dayTasks.length === 0) return null
          return (
            <section key={day.toISOString()}>
              <h3
                className={[
                  'mb-2 text-sm font-semibold',
                  isToday(day) ? 'text-accent' : 'text-text-primary',
                ].join(' ')}
              >
                {isToday(day) ? 'Today' : format(day, 'EEEE, MMM d')}
              </h3>
              <ul className="space-y-1">
                {dayTasks.map((task) => {
                  const label = formatDueRange(
                    {
                      due_date: task.due_date,
                      start_date: task.start_date,
                      is_all_day: task.is_all_day,
                    },
                    timeFormat,
                  )
                  return (
                    <li key={task.instance_key ?? task.id}>
                      <button
                        type="button"
                        onClick={() => {
                          openTaskPopup(task.id)
                        }}
                        onContextMenu={(e) => openTaskContextMenu(e, task.id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-accent/40"
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={calendarTaskDotStyle(task)}
                        />
                        <span
                          className={[
                            'min-w-0 flex-1 truncate text-sm',
                            task.status === 'completed'
                              ? 'text-text-muted line-through'
                              : 'text-text-primary',
                          ].join(' ')}
                        >
                          {task.title || 'Untitled'}
                        </span>
                        {label && (
                          <span className="shrink-0 text-xs text-text-muted">{label}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
        {tasks.length === 0 && (
          <p className="text-sm text-text-muted">No upcoming tasks in this range.</p>
        )}
      </div>
    </div>
  )
}

/** Parse store cursor `yyyy-MM-dd` to local Date at noon. */
export function parseCursorDate(cursorDate: string): Date {
  try {
    return parseISO(`${cursorDate}T12:00:00`)
  } catch {
    return new Date()
  }
}
