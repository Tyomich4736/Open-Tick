import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Inbox,
  Sun,
} from 'lucide-react'
import type { SmartListId } from '@shared/filters'
import { SMART_LIST_LABELS, smartListPath } from '@shared/smartListSettings'
import { useSmartListSettings } from '@/hooks/useSmartListSettings'
import { useTaskCount } from '@/hooks/useTasks'
import { useUiStore } from '@/stores/uiStore'
import { SidebarItem } from './SidebarItem'

const SMART_LIST_ICONS: Record<SmartListId, LucideIcon> = {
  inbox: Inbox,
  today: Sun,
  tomorrow: CalendarDays,
  week: CalendarRange,
  overdue: AlertCircle,
  completed: CheckCircle2,
}

export function SidebarSmartLists({ collapsed }: { collapsed: boolean }) {
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const { config } = useSmartListSettings()
  const { data: todayCount = 0 } = useTaskCount({ smart_list: 'today', parent_id: null })
  const { data: overdueCount = 0 } = useTaskCount({ smart_list: 'overdue', parent_id: null })

  const badges: Partial<Record<SmartListId, number>> = {
    today: todayCount,
    overdue: overdueCount,
  }

  const visible = config.filter((item) => item.enabled)
  if (visible.length === 0) return null

  return (
    <>
      {!collapsed && (
        <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          Smart lists
        </p>
      )}
      <ul className="space-y-0.5">
        {visible.map((item) => {
          const to = smartListPath(item.id)
          const label = SMART_LIST_LABELS[item.id]
          return (
            <li key={item.id}>
              <SidebarItem
                to={to}
                label={label}
                icon={SMART_LIST_ICONS[item.id]}
                badge={badges[item.id]}
                collapsed={collapsed}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({
                    type: 'smart',
                    path: to,
                    label,
                    x: e.clientX,
                    y: e.clientY,
                  })
                }}
              />
            </li>
          )
        })}
      </ul>
    </>
  )
}
