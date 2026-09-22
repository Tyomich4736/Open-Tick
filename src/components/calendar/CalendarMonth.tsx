import { useMemo } from 'react'
import {
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
} from 'date-fns'
import type { TaskListItem } from '@shared/entities'
import { monthGridRange, tasksForDay, type WeekStartsOn } from '@/lib/calendarUtils'
import { openTaskContextMenu } from '@/lib/openTaskContextMenu'
import { calendarTaskChromeStyle, calendarTaskDotStyle } from '@/lib/theme'
import { useCalendarStore } from '@/stores/calendarStore'

interface CalendarMonthProps {
  cursor: Date
  tasks: TaskListItem[]
  weekStartsOn: WeekStartsOn
}

const WEEKDAY_LABELS_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const WEEKDAY_LABELS_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function CalendarMonth({ cursor, tasks, weekStartsOn }: CalendarMonthProps) {
  const setMode = useCalendarStore((s) => s.setMode)
  const setCursorDate = useCalendarStore((s) => s.setCursorDate)
  const openTaskPopup = useCalendarStore((s) => s.openTaskPopup)

  const { start, end } = useMemo(
    () => monthGridRange(cursor, weekStartsOn),
    [cursor, weekStartsOn],
  )

  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end])
  const labels = weekStartsOn === 0 ? WEEKDAY_LABELS_SUN : WEEKDAY_LABELS_MON

  const openDay = (day: Date) => {
    setCursorDate(day)
    setMode('day')
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-2 grid grid-cols-7 gap-1">
        {labels.map((label) => (
          <div key={label} className="px-1 text-center text-xs font-medium text-text-muted">
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1" style={{ gridAutoRows: '1fr' }}>
        {days.map((day) => {
          const dayTasks = tasksForDay(tasks, day)
          const inMonth = isSameMonth(day, cursor)
          const today = isToday(day)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => openDay(day)}
              className={[
                'flex min-h-[4.5rem] flex-col rounded-lg border p-1.5 text-left transition-colors',
                inMonth ? 'border-border bg-bg-primary' : 'border-transparent bg-bg-secondary/40',
                today ? 'ring-1 ring-accent' : 'hover:border-accent/40',
              ].join(' ')}
            >
              <span
                className={[
                  'mb-1 text-xs font-medium',
                  today ? 'text-accent' : inMonth ? 'text-text-primary' : 'text-text-muted',
                ].join(' ')}
              >
                {format(day, 'd')}
              </span>
              <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {dayTasks.slice(0, 3).map((task) => (
                  <span
                    key={task.instance_key ?? task.id}
                    role="presentation"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTaskPopup(task.id)
                    }}
                    onContextMenu={(e) => openTaskContextMenu(e, task.id)}
                    className="truncate rounded px-1 text-[10px] leading-4 text-text-primary"
                    style={calendarTaskChromeStyle(task, { washAlpha: '22' })}
                    title={task.title}
                  >
                    {task.title || 'Untitled'}
                  </span>
                ))}
                {dayTasks.length > 3 && (
                  <span className="px-1 text-[10px] text-text-muted">+{dayTasks.length - 3}</span>
                )}
                {dayTasks.length === 0 && (
                  <span className="mt-auto flex justify-center gap-0.5 pb-0.5">
                    {/* empty day — subtle dots area reserved */}
                  </span>
                )}
                {dayTasks.length > 0 && dayTasks.length <= 3 && (
                  <span className="mt-auto flex justify-center gap-0.5">
                    {dayTasks.slice(0, Math.min(dayTasks.length, 4)).map((t) => (
                      <span
                        key={`dot-${t.instance_key ?? t.id}`}
                        className="size-1 rounded-full"
                        style={calendarTaskDotStyle(t)}
                      />
                    ))}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
