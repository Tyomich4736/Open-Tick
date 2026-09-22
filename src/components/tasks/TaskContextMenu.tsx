import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { addDays, formatISO, startOfDay } from 'date-fns'
import type { Priority } from '@shared/entities'
import { useProjects } from '@/hooks/useProjects'
import { useTags, useTaskDetail } from '@/hooks/useTasks'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useViewportMenuPosition } from '@/hooks/useViewportMenuPosition'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { priorityLabels } from '@/lib/priority'

type Submenu = 'date' | 'priority' | 'tags' | 'move' | null

export function TaskContextMenu() {
  const menu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const focusSubtaskAdd = useUiStore((s) => s.focusSubtaskAdd)
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const { updateTask, toggleComplete, deleteTask } = useTaskMutations()
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const addToast = useToastStore((s) => s.addToast)
  const closeTimer = useRef<number | null>(null)
  const [submenu, setSubmenu] = useState<Submenu>(null)

  const taskId = menu?.type === 'task' ? menu.id : null
  const { data: task } = useTaskDetail(taskId)

  // Suppress single menu while bulk menu owns the interaction
  const isBulk =
    menu?.type === 'task' && selectedIds.length >= 2 && selectedIds.includes(menu.id)

  const menuOpen = Boolean(menu && menu.type === 'task' && task && !isBulk)
  const { ref, style } = useViewportMenuPosition(
    menuOpen,
    menu?.x ?? 0,
    menu?.y ?? 0,
    220,
  )

  useEffect(() => {
    setSubmenu(null)
  }, [menu])

  useEffect(() => {
    if (!menu || menu.type !== 'task' || isBulk) return
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
  }, [menu, setContextMenu, ref])

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  if (!menu || menu.type !== 'task' || !task || isBulk) return null

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
    updateTask.mutate({
      id: task!.id,
      input: { due_date: due, is_all_day: daysFromNow !== null ? true : task!.is_all_day },
    })
    close()
  }

  function setPriority(priority: Priority) {
    updateTask.mutate({ id: task!.id, input: { priority } })
    close()
  }

  function toggleTag(name: string) {
    const next = task!.tags.includes(name)
      ? task!.tags.filter((t) => t !== name)
      : [...task!.tags, name]
    updateTask.mutate({ id: task!.id, input: { tags: next } })
  }

  async function duplicate() {
    const result = await ipc.tasks.duplicate(task!.id)
    if (result.ok) {
      selectOne(result.data.id)
      addToast('Task duplicated', 'success')
    } else {
      addToast(result.error.message, 'error')
    }
    close()
  }

  async function openWindow() {
    const result = await ipc.tasks.openWindow(task!.id)
    if (!result.ok) addToast(result.error.message, 'error')
    close()
  }

  async function pinAsSticky() {
    const result = await ipc.stickies.open(task!.id)
    if (!result.ok) addToast(result.error.message, 'error')
    close()
  }

  async function copyLink() {
    const link = `${window.location.origin}${window.location.pathname}#/task-window/${task!.id}`
    try {
      await navigator.clipboard.writeText(link)
      addToast('Link copied', 'success')
    } catch {
      addToast('Could not copy link', 'error')
    }
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
                active={task.priority === p}
                onClick={() => setPriority(p)}
              />
            ))}
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger label="Tags" active={submenu === 'tags'} onHover={() => openSub('tags')}>
        {submenu === 'tags' && (
          <div className={flyoutClass} onMouseEnter={() => openSub('tags')}>
            {tags.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-text-muted">No tags yet</p>
            ) : (
              tags.map((tag) => (
                <MenuItem
                  key={tag.id}
                  label={tag.name}
                  active={task.tags.includes(tag.name)}
                  onClick={() => toggleTag(tag.name)}
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
                active={task.project_id === p.id}
                onClick={() => {
                  updateTask.mutate({ id: task.id, input: { project_id: p.id } })
                  close()
                }}
              />
            ))}
          </div>
        )}
      </SubmenuTrigger>

      <Divider />
      <MenuItem
        label="Add subtask"
        onHover={scheduleCloseSub}
        onClick={() => {
          selectOne(task.id)
          focusSubtaskAdd()
          close()
        }}
      />
      <MenuItem label="Duplicate" onHover={scheduleCloseSub} onClick={() => void duplicate()} />
      <MenuItem label="Copy link" onHover={scheduleCloseSub} onClick={() => void copyLink()} />
      <MenuItem
        label="Open in new window"
        onHover={scheduleCloseSub}
        onClick={() => void openWindow()}
      />
      <MenuItem
        label="Open as sticky note"
        onHover={scheduleCloseSub}
        onClick={() => void pinAsSticky()}
      />
      <Divider />
      <MenuItem
        label={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
        onHover={scheduleCloseSub}
        onClick={() => {
          toggleComplete.mutate({ id: task.id, completed: task.status === 'completed' })
          close()
        }}
      />
      <MenuItem
        label="Delete"
        danger
        onHover={scheduleCloseSub}
        onClick={() => {
          if (window.confirm(`Delete “${task.title}”?`)) {
            deleteTask.mutate(task.id)
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
  active,
}: {
  label: string
  onClick: () => void
  onHover?: () => void
  danger?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={[
        'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5',
        danger ? 'text-priority-high' : 'text-text-primary',
        active ? 'font-medium text-accent' : '',
      ].join(' ')}
    >
      <span>{label}</span>
      {active && <span className="text-accent">✓</span>}
    </button>
  )
}
