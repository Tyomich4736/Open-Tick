import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { format, isToday } from 'date-fns'
import type { TaskListItem } from '@shared/entities'
import {
  HOUR_HEIGHT_PX,
  effectiveEnd,
  effectiveStart,
  formatHourLabel,
  layoutTimedEvents,
  localSlotIso,
  minutesFromMidnight,
  snapMinutes,
  tasksForDay,
} from '@/lib/calendarUtils'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { useCalendarVisibleHours } from '@/hooks/useCalendarVisibleHours'
import { useCalendarStore } from '@/stores/calendarStore'
import { openTaskContextMenu } from '@/lib/openTaskContextMenu'
import { calendarTaskChromeStyle } from '@/lib/theme'

export interface GridCreateRange {
  start_date: string
  due_date: string
  is_all_day: boolean
}

interface CalendarTimeGridProps {
  days: Date[]
  tasks: TaskListItem[]
  onCreateRange: (range: GridCreateRange) => void
  /** Show weekday header above all-day row (week/day views). */
  showHeader?: boolean
}

const GUTTER_PX = 56 // w-14

function minsToTime24(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function dayColumnsStyle(dayCount: number): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `${GUTTER_PX}px repeat(${dayCount}, minmax(0, 1fr))`,
  }
}

export function CalendarTimeGrid({
  days,
  tasks,
  onCreateRange,
  showHeader = true,
}: CalendarTimeGridProps) {
  const { timeFormat } = useTimeFormat()
  const { startHour, endHour } = useCalendarVisibleHours()
  const openTaskPopup = useCalendarStore((s) => s.openTaskPopup)
  const requestFocusTitle = useCalendarStore((s) => s.requestFocusTitle)

  const rangeStartMin = startHour * 60
  const rangeEndMin = endHour * 60
  const hourCount = Math.max(1, endHour - startHour)

  const [drag, setDrag] = useState<{
    dayIndex: number
    startMin: number
    endMin: number
  } | null>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  const hours = useMemo(
    () => Array.from({ length: hourCount }, (_, i) => startHour + i),
    [startHour, hourCount],
  )
  const cols = dayColumnsStyle(days.length)

  const slotFromY = (clientY: number, columnTop: number): number => {
    const y = clientY - columnTop
    const raw = rangeStartMin + (y / HOUR_HEIGHT_PX) * 60
    return snapMinutes(
      Math.max(rangeStartMin, Math.min(rangeEndMin - 30, raw)),
    )
  }

  const allDayByDay = useMemo(
    () => days.map((day) => tasksForDay(tasks, day).filter((t) => t.is_all_day)),
    [days, tasks],
  )

  const laidOutByDay = useMemo(() => {
    return days.map((day) => {
      const timed = tasksForDay(tasks, day).filter((t) => !t.is_all_day && t.due_date)
      const items = timed.flatMap((task) => {
        const start = effectiveStart(task)
        const end = effectiveEnd(task)
        if (!start || !end) return []
        const dayStart = new Date(day)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)
        const clipStart = start < dayStart ? dayStart : start
        const clipEnd = end > dayEnd ? dayEnd : end
        let startMin = minutesFromMidnight(clipStart)
        let endMin = minutesFromMidnight(clipEnd)
        if (endMin <= startMin) endMin = startMin + 30
        // Skip if entirely outside visible window
        if (endMin <= rangeStartMin || startMin >= rangeEndMin) return []
        startMin = Math.max(startMin, rangeStartMin)
        endMin = Math.min(endMin, rangeEndMin)
        if (endMin <= startMin) return []
        return [{ task, startMin, endMin }]
      })
      return layoutTimedEvents(items)
    })
  }, [days, tasks, rangeStartMin, rangeEndMin])

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="sticky top-0 z-30 bg-bg-primary">
        {showHeader && (
          <div style={cols} className="border-b border-border">
            <div />
            {days.map((day) => (
              <div
                key={`hdr-${day.toISOString()}`}
                className={[
                  'border-l border-border px-2 py-2 text-center',
                  isToday(day) ? 'text-accent' : 'text-text-muted',
                ].join(' ')}
              >
                <div className="text-[10px] uppercase">{format(day, 'EEE')}</div>
                <div
                  className={`text-sm font-semibold ${
                    isToday(day) ? 'text-accent' : 'text-text-primary'
                  }`}
                >
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={cols} className="border-b border-border">
          <div className="px-1 py-2 text-[10px] text-text-muted">All day</div>
          {days.map((day, i) => (
            <div
              key={`allday-${day.toISOString()}`}
              className={[
                'min-h-[2.5rem] border-l border-border px-1 py-1',
                isToday(day) ? 'bg-accent/5' : '',
              ].join(' ')}
            >
              <div className="flex flex-col gap-0.5">
                {allDayByDay[i].map((task) => (
                  <button
                    key={task.instance_key ?? task.id}
                    type="button"
                    onClick={() => {
                      openTaskPopup(task.id)
                    }}
                    onContextMenu={(e) => openTaskContextMenu(e, task.id)}
                    className={[
                      'truncate rounded px-1 py-0.5 text-left text-[10px]',
                      task.status === 'completed'
                        ? 'text-text-muted line-through opacity-70'
                        : 'text-text-primary',
                    ].join(' ')}
                    style={calendarTaskChromeStyle(task, { washAlpha: '33' })}
                  >
                    {task.title || 'Untitled'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cols, minHeight: HOUR_HEIGHT_PX * hourCount }}>
        <div className="relative">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute right-1 text-[10px] text-text-muted"
              style={{ top: i * HOUR_HEIGHT_PX - 6 }}
            >
              {formatHourLabel(h, timeFormat)}
            </div>
          ))}
        </div>

        {days.map((day, dayIndex) => (
          <div
            key={day.toISOString()}
            ref={(el) => {
              columnRefs.current[dayIndex] = el
            }}
            className={[
              'relative border-l border-border',
              isToday(day) ? 'bg-accent/[0.03]' : '',
            ].join(' ')}
            onMouseDown={(e) => {
              if (e.button !== 0) return
              const el = columnRefs.current[dayIndex]
              if (!el) return
              const rect = el.getBoundingClientRect()
              const startMin = slotFromY(e.clientY, rect.top)
              setDrag({ dayIndex, startMin, endMin: Math.min(startMin + 60, rangeEndMin) })
              e.preventDefault()

              const onMove = (ev: MouseEvent) => {
                setDrag({
                  dayIndex,
                  startMin,
                  endMin: slotFromY(ev.clientY, rect.top),
                })
              }
              const onUp = (ev: MouseEvent) => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
                const endMin = slotFromY(ev.clientY, rect.top)
                const from = Math.min(startMin, endMin)
                const to = Math.max(startMin, endMin)
                const end = Math.min(to <= from ? from + 60 : to, rangeEndMin)
                onCreateRange({
                  start_date: localSlotIso(day, minsToTime24(from), false),
                  due_date: localSlotIso(
                    day,
                    minsToTime24(Math.min(end, 24 * 60 - 1)),
                    false,
                  ),
                  is_all_day: false,
                })
                requestFocusTitle()
                setDrag(null)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/60"
                style={{ top: i * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
              />
            ))}

            {laidOutByDay[dayIndex].map((item) => {
              const top = ((item.startMin - rangeStartMin) / 60) * HOUR_HEIGHT_PX
              const height = Math.max(
                16,
                ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT_PX,
              )
              const widthPct = 100 / item.colCount
              const leftPct = (item.col / item.colCount) * 100
              const gap = 2
              const short = height < 28
              const maxLines = height < 22 ? 1 : height < 40 ? 1 : height < 64 ? 2 : 3

              return (
                <button
                  key={item.task.instance_key ?? item.task.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openTaskPopup(item.task.id)
                  }}
                  onContextMenu={(e) => openTaskContextMenu(e, item.task.id)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={[
                    'absolute z-10 flex overflow-hidden rounded text-left text-[10px] leading-tight shadow-sm',
                    short ? 'items-center px-1' : 'items-start px-1 py-0.5',
                    item.task.status === 'completed'
                      ? 'text-text-muted opacity-70'
                      : 'text-text-primary',
                  ].join(' ')}
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + ${gap}px)`,
                    width: `calc(${widthPct}% - ${gap * 2}px)`,
                    ...calendarTaskChromeStyle(item.task, { washAlpha: '44', borderWidth: 3 }),
                  }}
                  title={item.task.title}
                >
                  <span
                    className={[
                      'min-h-0 w-full overflow-hidden font-medium break-words',
                      item.task.status === 'completed' ? 'line-through' : '',
                    ].join(' ')}
                    style={{
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: maxLines,
                    }}
                  >
                    {item.task.title || 'Untitled'}
                  </span>
                </button>
              )
            })}

            {drag && drag.dayIndex === dayIndex && (
              <div
                className="pointer-events-none absolute inset-x-0.5 z-20 rounded bg-accent/25 ring-1 ring-accent"
                style={{
                  top:
                    ((Math.min(drag.startMin, drag.endMin) - rangeStartMin) / 60) *
                    HOUR_HEIGHT_PX,
                  height: Math.max(
                    HOUR_HEIGHT_PX / 2,
                    (Math.abs(drag.endMin - drag.startMin) / 60) * HOUR_HEIGHT_PX ||
                      HOUR_HEIGHT_PX,
                  ),
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
