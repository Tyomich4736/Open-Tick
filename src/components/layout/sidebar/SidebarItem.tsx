import type { ComponentType, DragEvent, MouseEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function SectionHeader({
  label,
  expanded,
  onToggle,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-1.5 flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
      aria-expanded={expanded}
    >
      <ChevronRight
        className={[
          'size-3.5 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
          expanded ? 'rotate-90' : 'rotate-0',
        ].join(' ')}
      />
      <span className="flex-1">{label}</span>
    </button>
  )
}

export function SidebarItem({
  to,
  label,
  icon: Icon,
  badge,
  color,
  depth = 0,
  collapsed,
  draggable,
  dropHighlight,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onContextMenu,
}: {
  to: string
  label: string
  icon?: ComponentType<{ className?: string }>
  badge?: number
  color?: string
  depth?: number
  collapsed?: boolean
  draggable?: boolean
  dropHighlight?: boolean
  onDragStart?: (e: DragEvent) => void
  onDragOver?: (e: DragEvent) => void
  onDragLeave?: (e: DragEvent) => void
  onDrop?: (e: DragEvent) => void
  onDragEnd?: (e: DragEvent) => void
  onContextMenu?: (e: MouseEvent) => void
}) {
  const navigate = useNavigate()

  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      draggable={draggable}
      onClick={(e) => {
        // Keep modified clicks in-app (don't open a new Electron/browser window)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          e.preventDefault()
          void navigate(to)
        }
      }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      style={{ paddingLeft: collapsed ? undefined : `${12 + depth * 14}px` }}
      className={({ isActive }) =>
        [
          'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
          collapsed ? 'justify-center px-2' : 'px-3',
          dropHighlight
            ? 'bg-accent/15 ring-1 ring-inset ring-accent/40'
            : isActive
              ? 'bg-accent/10 font-medium text-accent'
              : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5',
        ].join(' ')
      }
    >
      {color ? (
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        Icon && <Icon className="size-4 shrink-0 opacity-70" />
      )}
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
          {badge}
        </span>
      )}
    </NavLink>
  )
}
