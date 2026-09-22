import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addDays, formatISO, startOfDay } from 'date-fns'
import type { Priority } from '@shared/entities'
import { useProjects } from '@/hooks/useProjects'
import { useTags } from '@/hooks/useTasks'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useViewportMenuPosition } from '@/hooks/useViewportMenuPosition'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { useSelectedTaskStatuses } from '@/components/tasks/TaskPanelMultiSelect'
import { priorityLabels } from '@/lib/priority'

type Submenu = 'date' | 'priority' | 'tags' | 'move' | null

export function BulkTaskContextMenu() {
  const menu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const { bulkUpdate, bulkComplete, bulkDelete } = useTaskMutations()
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const statuses = useSelectedTaskStatuses(selectedIds)
  const [submenu, setSubmenu] = useState<Submenu>(null)
  const closeTimer = useRef<number | null>(null)

  const active =
    menu?.type === 'task' &&
    selectedIds.length >= 2 &&
    selectedIds.includes(menu.id)

  const { ref, style } = useViewportMenuPosition(
    Boolean(active && menu),
    menu?.x ?? 0,
    menu?.y ?? 0,
    220,
  )

  useEffect(() => {
    setSubmenu(null)
  }, [menu])

  useEffect(() => {
    if (!active) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [active, setContextMenu, ref])

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  if (!active || !menu || menu.type !== 'task') return null

  const ids = selectedIds
  const n = ids.length
  const known = ids.filter((id) => statuses.has(id))
  const allCompleted =
    known.length > 0 && known.every((id) => statuses.get(id) === 'completed')
  const allPending =
    known.length > 0 && known.every((id) => statuses.get(id) === 'pending')

  const openLeft = menu.x > window.innerWidth - 420

  function close() {
    setContextMenu(null)
  }

  function openSub(next: Submenu) {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setSubmenu(next)
  }

  function scheduleCloseSub() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setSubmenu(null), 120)
  }

  function setDue(daysFromNow: number | null) {
    const due =
      daysFromNow === null
        ? null
        : formatISO(addDays(startOfDay(new Date()), daysFromNow))
    bulkUpdate.mutate({
      ids,
      patch: {
        due_date: due,
        is_all_day: daysFromNow !== null ? true : undefined,
      },
    })
    close()
  }

  const flyoutClass = [
    'absolute top-0 z-10 min-w-44 rounded-lg border border-border bg-bg-primary py-1 shadow-xl',
    openLeft ? 'right-full mr-1' : 'left-full ml-1',
  ].join(' ')

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="fixed z-50 min-w-52 rounded-lg border border-border bg-bg-primary py-1 shadow-xl"
      onMouseLeave={scheduleCloseSub}
    >
      <p className="px-3 py-1.5 text-xs font-medium text-text-muted">
        {n} tasks selected
      </p>
      <Divider />

      <SubmenuTrigger
        label="Date & reminder"
        active={submenu === 'date'}
        onHover={() => openSub('date')}
      >
        {submenu === 'date' && (
          <div className={flyoutClass} onMouseEnter={() => openSub('date')}>
            <MenuItem label="Today" onClick={() => setDue(0)} />
            <MenuItem label="Tomorrow" onClick={() => setDue(1)} />
            <MenuItem label="Next week" onClick={() => setDue(7)} />
            <MenuItem label="Clear date" onClick={() => setDue(null)} />
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger
        label="Priority"
        active={submenu === 'priority'}
        onHover={() => openSub('priority')}
      >
        {submenu === 'priority' && (
          <div className={flyoutClass} onMouseEnter={() => openSub('priority')}>
            {([0, 1, 3, 5] as Priority[]).map((p) => (
              <MenuItem
                key={p}
                label={priorityLabels[p]}
                onClick={() => {
                  bulkUpdate.mutate({ ids, patch: { priority: p } })
                  close()
                }}
              />
            ))}
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger label="Tags" active={submenu === 'tags'} onHover={() => openSub('tags')}>
        {submenu === 'tags' && (
          <div
            className={`${flyoutClass} max-h-64 overflow-y-auto`}
            onMouseEnter={() => openSub('tags')}
          >
            {tags.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-text-muted">No tags yet</p>
            ) : (
              tags.map((tag) => (
                <MenuItem
                  key={tag.id}
                  label={`Add #${tag.name}`}
                  onClick={() => {
                    bulkUpdate.mutate({ ids, patch: { add_tags: [tag.name] } })
                    close()
                  }}
                />
              ))
            )}
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger
        label="Move to list"
        active={submenu === 'move'}
        onHover={() => openSub('move')}
      >
        {submenu === 'move' && (
          <div
            className={`${flyoutClass} max-h-64 overflow-y-auto`}
            onMouseEnter={() => openSub('move')}
          >
            {projects.map((p) => (
              <MenuItem
                key={p.id}
                label={p.name}
                onClick={() => {
                  bulkUpdate.mutate({ ids, patch: { project_id: p.id } })
                  close()
                }}
              />
            ))}
          </div>
        )}
      </SubmenuTrigger>

      <Divider />
      <MenuItem
        label="Mark complete"
        disabled={allCompleted}
        onHover={scheduleCloseSub}
        onClick={() => {
          bulkComplete.mutate({ ids, completed: true })
          close()
        }}
      />
      <MenuItem
        label="Mark incomplete"
        disabled={allPending}
        onHover={scheduleCloseSub}
        onClick={() => {
          bulkComplete.mutate({ ids, completed: false })
          close()
        }}
      />
      <Divider />
      <MenuItem
        label="Delete"
        danger
        onHover={scheduleCloseSub}
        onClick={() => {
          if (window.confirm(`Delete ${n} tasks?`)) {
            bulkDelete.mutate(ids)
            clearSelection()
          }
          close()
        }}
      />
    </div>,
    document.body,
  )
}

function Divider() {
  return <div className="my-1 border-t border-border" />
}

function SubmenuTrigger({
  label,
  active,
  onHover,
  children,
}: {
  label: string
  active?: boolean
  onHover: () => void
  children?: ReactNode
}) {
  return (
    <div className="relative" onMouseEnter={onHover}>
      <div
        className={[
          'flex w-full cursor-default items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-text-primary',
          active ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <span>{label}</span>
        <span className="text-text-muted">›</span>
      </div>
      {children}
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  onHover,
  danger,
  disabled,
}: {
  label: string
  onClick: () => void
  onHover?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onHover}
      className={[
        'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm',
        disabled
          ? 'cursor-not-allowed text-text-muted opacity-40'
          : 'hover:bg-black/5 dark:hover:bg-white/5',
        !disabled && danger ? 'text-priority-high' : '',
        !disabled && !danger ? 'text-text-primary' : '',
      ].join(' ')}
    >
      <span>{label}</span>
    </button>
  )
}
