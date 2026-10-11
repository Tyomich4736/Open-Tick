import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Inbox,
  Sun,
} from 'lucide-react'
import { useTaskCount } from '@/hooks/useTasks'
import { useUiStore } from '@/stores/uiStore'
import { SidebarItem } from './SidebarItem'

export function SidebarSmartLists({ collapsed }: { collapsed: boolean }) {
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const { data: todayCount = 0 } = useTaskCount({ smart_list: 'today', parent_id: null })
  const { data: overdueCount = 0 } = useTaskCount({ smart_list: 'overdue', parent_id: null })

  const smartLists = [
    { to: '/inbox', label: 'Inbox', icon: Inbox },
    { to: '/today', label: 'Today', icon: Sun, badge: todayCount },
    { to: '/tomorrow', label: 'Tomorrow', icon: CalendarDays },
    { to: '/week', label: 'Next 7 Days', icon: CalendarRange },
    {
      to: '/overdue',
      label: 'Overdue',
      icon: AlertCircle,
      badge: overdueCount,
    },
    { to: '/completed', label: 'Completed', icon: CheckCircle2 },
  ] as const

  return (
    <>
      {!collapsed && (
        <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          Smart lists
        </p>
      )}
      <ul className="space-y-0.5">
        {smartLists.map((item) => (
          <li key={item.to}>
            <SidebarItem
              {...item}
              collapsed={collapsed}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({
                  type: 'smart',
                  path: item.to,
                  label: item.label,
                  x: e.clientX,
                  y: e.clientY,
                })
              }}
            />
          </li>
        ))}
      </ul>
    </>
  )
}
