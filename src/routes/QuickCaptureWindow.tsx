import { useEffect, useRef, useState } from 'react'
import { ipc } from '@/lib/ipc-client'

export function QuickCaptureWindow() {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function submit() {
    const trimmed = title.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      const projects = await ipc.projects.list()
      if (!projects.ok) {
        setError(projects.error.message)
        return
      }
      const inbox = projects.data.find((p) => p.is_inbox)
      if (!inbox) {
        setError('Inbox not found')
        return
      }
      const created = await ipc.tasks.create({ title: trimmed, project_id: inbox.id })
      if (!created.ok) {
        setError(created.error.message)
        return
      }
      setTitle('')
      await ipc.desktop.closeQuickCapture()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen items-center bg-bg-primary px-3">
      <form
        className="flex w-full items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              void ipc.desktop.closeQuickCapture()
            }
          }}
          placeholder="Add a task to Inbox…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && (
        <p className="absolute bottom-1 left-3 right-3 truncate text-xs text-priority-high">
          {error}
        </p>
      )}
    </div>
  )
}
