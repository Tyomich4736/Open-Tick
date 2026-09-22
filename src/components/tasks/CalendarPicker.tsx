import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWeekStartsOn } from '@/hooks/useWeekStartsOn'

interface CalendarPickerProps {
  /** `yyyy-MM-dd` or empty */
  value: string
  onChange: (dateStr: string) => void
}

export function CalendarPicker({ value, onChange }: CalendarPickerProps) {
  const { weekStartsOn } = useWeekStartsOn()
  const selected = value ? new Date(`${value}T12:00:00`) : null
  const [cursor, setCursor] = useState(() => selected ?? new Date())

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn })
    const days = eachDayOfInterval({ start, end })
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
  }, [cursor, weekStartsOn])

  const weekdays =
    weekStartsOn === 0
      ? ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
      : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor((c) => subMonths(c, 1))}
          className="rounded p-1 text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-text-primary">{format(cursor, 'MMMM yyyy')}</span>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="rounded p-1 text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {weekdays.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-text-muted">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weeks.flat().map((day) => {
          const inMonth = isSameMonth(day, cursor)
          const isSelected = selected ? isSameDay(day, selected) : false
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onChange(format(day, 'yyyy-MM-dd'))}
              className={[
                'rounded-md py-1.5 text-xs transition-colors',
                isSelected
                  ? 'bg-accent text-white'
                  : isToday(day)
                    ? 'font-semibold text-accent'
                    : inMonth
                      ? 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                      : 'text-text-muted/50',
              ].join(' ')}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
