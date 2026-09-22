import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, List } from 'lucide-react'

interface ViewModeSwitcherProps {
  /** When on calendar, link back to this list path (default /inbox). */
  listPath?: string
}

export function ViewModeSwitcher({ listPath = '/inbox' }: ViewModeSwitcherProps) {
  const location = useLocation()
  const isCalendar = location.pathname.startsWith('/calendar')

  const base =
    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors'
  const active = 'border-accent bg-accent/10 text-accent'
  const inactive = 'border-border text-text-muted hover:border-accent/40 hover:text-text-primary'

  return (
    <div className="inline-flex gap-1 rounded-xl border border-border p-0.5">
      <Link
        to={listPath}
        className={[base, !isCalendar ? active : inactive].join(' ')}
        aria-current={!isCalendar ? 'page' : undefined}
      >
        <List className="size-3.5" />
        List
      </Link>
      <Link
        to="/calendar"
        className={[base, isCalendar ? active : inactive].join(' ')}
        aria-current={isCalendar ? 'page' : undefined}
      >
        <CalendarDays className="size-3.5" />
        Calendar
      </Link>
    </div>
  )
}
