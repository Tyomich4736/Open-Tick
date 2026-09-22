import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Pin, Shirt, X } from 'lucide-react'
import type { TaskDetail, UpdateTaskInput } from '@shared/entities'
import { MarkdownEditor } from '@/components/tasks/MarkdownEditor'
import { useTaskDetail } from '@/hooks/useTasks'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { ipc } from '@/lib/ipc-client'
import { queryKeys } from '@/lib/queryClient'

/** TickTick-like sticky paper colors */
const STICKY_COLORS = [
  '#fff59d', // yellow (default)
  '#c8e6c9', // green
  '#bbdefb', // blue
  '#f8bbd0', // pink
  '#e1bee7', // purple
  '#ffe0b2', // orange
  '#f5f5f5', // light gray
] as const

const DEFAULT_COLOR = STICKY_COLORS[0]

function useStickyDebouncedSave(
  task: TaskDetail | undefined,
  onSave: (patch: UpdateTaskInput) => void,
) {
  const [title, setTitleState] = useState('')
  const [content, setContentState] = useState('')
  const dirtyRef = useRef<{ title: boolean; content: boolean }>({
    title: false,
    content: false,
  })
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const isDirty = useCallback(
    () => dirtyRef.current.title || dirtyRef.current.content,
    [],
  )

  // Reset only when switching tasks
  useEffect(() => {
    if (!task) return
    dirtyRef.current = { title: false, content: false }
    setTitleState(task.title)
    setContentState(task.content ?? '')
  }, [task?.id])

  // Adopt server updates for fields the user isn't editing
  useEffect(() => {
    if (!task) return
    setTitleState((prev) => {
      if (dirtyRef.current.title) {
        if (prev === task.title) dirtyRef.current.title = false
        else return prev
      }
      return task.title
    })
    setContentState((prev) => {
      const server = task.content ?? ''
      if (dirtyRef.current.content) {
        if (prev === server) dirtyRef.current.content = false
        else return prev
      }
      return server
    })
  }, [task])

  useEffect(() => {
    if (!task) return
    const patch: UpdateTaskInput = {}
    if (dirtyRef.current.title && title !== task.title) patch.title = title
    if (dirtyRef.current.content && content !== (task.content ?? '')) patch.content = content
    if (Object.keys(patch).length === 0) return

    const timer = window.setTimeout(() => {
      onSaveRef.current(patch)
      // Keep dirty flags until server draft matches (effect above)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [title, content, task])

  return {
    title,
    content,
    isDirty,
    setTitle: (next: string) => {
      dirtyRef.current.title = true
      setTitleState(next)
    },
    setContent: (next: string) => {
      dirtyRef.current.content = true
      setContentState(next)
    },
  }
}

function useStickyTaskSync(taskId: string, isDirty: () => boolean) {
  const queryClient = useQueryClient()

  useEffect(() => {
    return ipc.onChanged((notification) => {
      if (notification.entityType !== 'task') return
      if (notification.entityId && notification.entityId !== taskId) return
      if (isDirty()) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) })
    })
  }, [taskId, queryClient, isDirty])
}

export function StickyNoteWindow({ taskId }: { taskId: string }) {
  const id = decodeURIComponent(taskId)
  const { data: task, isError, isFetched, error, isLoading } = useTaskDetail(id)
  const { updateTask, toggleComplete } = useTaskMutations()
  const [pinned, setPinned] = useState(false)
  const [color, setColor] = useState<string>(DEFAULT_COLOR)
  const [showColors, setShowColors] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)

  const { title, content, setTitle, setContent, isDirty } = useStickyDebouncedSave(
    task,
    (patch) => {
      updateTask.mutate({ id, input: patch })
    },
  )

  useStickyTaskSync(id, isDirty)

  useEffect(() => {
    document.documentElement.style.height = '100%'
    document.body.style.height = '100%'
    document.documentElement.style.backgroundColor = color
    document.body.style.backgroundColor = color
    const root = document.getElementById('root')
    if (root) {
      root.style.height = '100%'
      root.style.backgroundColor = color
    }
  }, [color])

  useEffect(() => {
    void ipc.stickies.get(id).then((result) => {
      if (result.ok && result.data) {
        setPinned(result.data.is_pinned)
        setColor(result.data.color || DEFAULT_COLOR)
      }
    })
  }, [id])

  useEffect(() => {
    if (task?.title) document.title = task.title
  }, [task?.title])

  const togglePin = useCallback(async () => {
    const next = !pinned
    const result = await ipc.stickies.setPinned(id, next)
    if (result.ok) {
      setPinned(result.data.is_pinned)
    }
  }, [id, pinned])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F12') {
        e.preventDefault()
        void togglePin()
      }
      if (e.key === 'Escape') setShowColors(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePin])

  async function closeSticky() {
    await ipc.stickies.close(id)
  }

  async function pickColor(next: string) {
    setColor(next)
    setShowColors(false)
    await ipc.stickies.updateBounds(id, { color: next })
  }

  const completed = task?.status === 'completed'
  const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties
  const noDragStyle = { WebkitAppRegion: 'no-drag' } as CSSProperties

  if (isFetched && (isError || !task)) {
    return (
      <div
        className="flex h-full flex-col p-3"
        style={{ backgroundColor: color, color: '#3e2723' }}
      >
        <div className="flex justify-end" style={dragStyle}>
          <button
            type="button"
            onClick={() => void closeSticky()}
            className="rounded p-1 hover:bg-black/10"
            style={noDragStyle}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm opacity-80">
          {error instanceof Error ? error.message : 'Task not found'}
        </p>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: color, color: '#3e2723' }}
      onMouseEnter={() => setChromeVisible(true)}
      onMouseLeave={() => {
        if (!showColors) setChromeVisible(false)
      }}
    >
      {/* TickTick-style top chrome — drag region; controls on hover */}
      <div
        className="relative flex h-8 shrink-0 items-center justify-end gap-0.5 px-1.5"
        style={dragStyle}
      >
        <div
          className={[
            'flex items-center gap-0.5 transition-opacity',
            chromeVisible || pinned || showColors ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={noDragStyle}
        >
          <div className="relative">
            <button
              type="button"
              title="Change color"
              onClick={() => setShowColors((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#5d4037]/70 hover:bg-black/10"
            >
              <Shirt className="h-3.5 w-3.5" />
            </button>
            {showColors && (
              <div className="absolute right-0 top-full z-20 mt-1 flex gap-1 rounded-lg border border-black/10 bg-white/95 p-1.5 shadow-lg">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => void pickColor(c)}
                    className={[
                      'h-5 w-5 rounded-full border border-black/15',
                      color === c ? 'ring-2 ring-[#5d4037]/50 ring-offset-1' : '',
                    ].join(' ')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            title={pinned ? 'Unpin (F12)' : 'Pin on top (F12)'}
            aria-pressed={pinned}
            onClick={() => void togglePin()}
            className={[
              'flex h-7 w-7 items-center justify-center rounded-md hover:bg-black/10',
              pinned ? 'text-[#e65100]' : 'text-[#5d4037]/70',
            ].join(' ')}
          >
            <Pin className={['h-3.5 w-3.5', pinned ? 'fill-current' : ''].join(' ')} />
          </button>
          <button
            type="button"
            title="Close"
            aria-label="Close sticky"
            onClick={() => void closeSticky()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#5d4037]/70 hover:bg-black/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Task row: checkbox + title (TickTick layout) */}
      <div className="flex items-start gap-2 px-3 pb-1" style={noDragStyle}>
        <button
          type="button"
          title={completed ? 'Mark incomplete' : 'Mark complete'}
          disabled={!task}
          onClick={() => {
            if (!task || toggleComplete.isPending) return
            toggleComplete.mutate({ id, completed })
          }}
          className={[
            'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2',
            completed
              ? 'border-[#66bb6a] bg-[#66bb6a] text-white'
              : 'border-[#8d6e63]/55 bg-transparent',
            toggleComplete.isPending ? 'opacity-60' : '',
          ].join(' ')}
        >
          {completed && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={[
            'min-w-0 flex-1 bg-transparent text-[15px] font-medium leading-snug outline-none placeholder:text-[#8d6e63]/55',
            completed ? 'text-[#8d6e63]/70 line-through' : '',
          ].join(' ')}
          placeholder={isLoading ? 'Loading…' : 'Task title'}
          aria-label="Task title"
        />
      </div>

      <div className="mx-3 border-t border-[#8d6e63]/15" />

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-1" style={noDragStyle}>
        {task ? (
          <MarkdownEditor value={content} onChange={setContent} variant="sticky" />
        ) : (
          <p className="px-1 py-2 text-[13px] text-[#8d6e63]/70">Loading…</p>
        )}
      </div>
    </div>
  )
}

export function StickyNoteWindowFromRoute() {
  const { taskId } = useParams<{ taskId: string }>()
  if (!taskId) {
    return <div className="p-4 text-sm text-neutral-600">Missing task</div>
  }
  return <StickyNoteWindow taskId={taskId} />
}
