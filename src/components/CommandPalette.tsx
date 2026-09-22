import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, CheckSquare, Search, Settings, StickyNote } from 'lucide-react'
import type { TaskListItem } from '@shared/entities'
import { ipc } from '@/lib/ipc-client'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { useToastStore } from '@/stores/toastStore'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

type PaletteAction = {
  id: string
  label: string
  hint?: string
  icon: typeof Search
  run: () => void | Promise<void>
}

type PaletteRow = {
  kind: 'action' | 'task'
  id: string
  label: string
  hint?: string
  icon: typeof Search
  run: () => void | Promise<void>
}

/** Lower = more relevant. Title hits beat content-only FTS matches. */
function titleRelevance(title: string, query: string): number {
  const t = title.toLowerCase()
  const q = query.toLowerCase()
  if (t === q) return 0
  if (t.startsWith(q)) return 1
  if (t.split(/[\s/_.:-]+/).some((w) => w.startsWith(q))) return 2
  if (t.includes(q)) return 3
  return 4
}

function openTaskFromSearch(
  task: TaskListItem,
  navigate: ReturnType<typeof useNavigate>,
) {
  useTaskSelectionStore.getState().openTask(task.id)
  if (task.project_is_inbox) navigate('/inbox')
  else if (task.project_id) navigate(`/project/${task.project_id}`)
  else navigate('/inbox')
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TaskListItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setActiveIndex(0)
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    const handle = window.setTimeout(() => {
      void ipc.tasks.list({ search: q, include_completed: true }).then((res) => {
        if (cancelled) return
        if (!res.ok) {
          setResults([])
          return
        }
        const ranked = [...res.data].sort(
          (a, b) => titleRelevance(a.title, q) - titleRelevance(b.title, q),
        )
        setResults(ranked.slice(0, 20))
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, open])

  const actions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [
      {
        id: 'nav-inbox',
        label: 'Go to Inbox',
        icon: CheckSquare,
        run: () => navigate('/inbox'),
      },
      {
        id: 'nav-today',
        label: 'Go to Today',
        icon: CheckSquare,
        run: () => navigate('/today'),
      },
      {
        id: 'nav-calendar',
        label: 'Open Calendar',
        icon: Calendar,
        run: () => navigate('/calendar'),
      },
      {
        id: 'nav-settings',
        label: 'Open Settings',
        icon: Settings,
        run: () => navigate('/settings'),
      },
      {
        id: 'new-task',
        label: 'New task in Inbox',
        hint: 'Creates an empty task',
        icon: CheckSquare,
        run: async () => {
          const projects = await ipc.projects.list()
          if (!projects.ok) {
            addToast(projects.error.message, 'error')
            return
          }
          const inbox = projects.data.find((p) => p.is_inbox)
          if (!inbox) return
          const created = await ipc.tasks.create({ title: 'New task', project_id: inbox.id })
          if (created.ok) {
            useTaskSelectionStore.getState().openTask(created.data.id)
            navigate('/inbox')
          } else addToast(created.error.message, 'error')
        },
      },
    ]

    if (selectedIds[0]) {
      list.unshift({
        id: 'open-sticky',
        label: 'Open selection as sticky note',
        icon: StickyNote,
        run: async () => {
          const result = await ipc.stickies.open(selectedIds[0])
          if (!result.ok) addToast(result.error.message, 'error')
        },
      })
    }

    return list
  }, [navigate, selectedIds, addToast])

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => a.label.toLowerCase().includes(q))
  }, [actions, query])

  const items = useMemo(() => {
    const actionRows: PaletteRow[] = filteredActions.map((a) => ({
      kind: 'action',
      id: a.id,
      label: a.label,
      hint: a.hint,
      icon: a.icon,
      run: a.run,
    }))
    const taskRows: PaletteRow[] = results.map((t) => ({
      kind: 'task',
      id: `task-${t.id}`,
      label: t.title,
      hint: t.project_name ?? undefined,
      icon: CheckSquare,
      run: () => openTaskFromSearch(t, navigate),
    }))
    // With a query, surface task hits (title-ranked) before jump actions.
    if (query.trim() && taskRows.length > 0) return [...taskRows, ...actionRows]
    return [...actionRows, ...taskRows]
  }, [filteredActions, results, navigate, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [items.length, query])

  const runActive = useCallback(async () => {
    const item = items[activeIndex]
    if (!item) return
    onClose()
    await item.run()
  }, [items, activeIndex, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-bg-primary shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-4 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActiveIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveIndex((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                void runActive()
              }
            }}
            placeholder="Search tasks or jump to…"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {items.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-text-muted">No results</li>
          )}
          {items.map((item, index) => {
            const Icon = item.icon
            const active = index === activeIndex
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void (async () => {
                    onClose()
                    await item.run()
                  })()}
                  className={[
                    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm',
                    active ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5',
                  ].join(' ')}
                >
                  <Icon className="size-4 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="shrink-0 text-xs text-text-muted">{item.hint}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
