import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'

interface TagChipsProps {
  value: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}

export function TagChips({ value, suggestions, onChange }: TagChipsProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setQuery('')
    setOpen(false)
  }

  const filtered = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(query.toLowerCase()),
  )

  const canCreate = query.trim() && !value.includes(query.trim())

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1.5">
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs text-accent"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Remove ${tag}`}
            className="rounded-full hover:bg-accent/20"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-[22px] items-center justify-center rounded-full border border-dashed border-border text-text-muted hover:border-accent hover:text-accent"
        aria-label="Add tag"
      >
        <Plus className="size-3.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-bg-primary p-2 shadow-lg">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (filtered[0]) addTag(filtered[0])
                else if (canCreate) addTag(query)
              }
              if (e.key === 'Escape') {
                setOpen(false)
                setQuery('')
              }
            }}
            placeholder="Find or create tag"
            className="w-full rounded-lg border border-border bg-bg-sidebar px-2.5 py-1.5 text-sm outline-none focus:border-accent"
          />
          <ul className="mt-1 max-h-36 overflow-y-auto">
            {filtered.slice(0, 6).map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                  onClick={() => addTag(tag)}
                >
                  {tag}
                </button>
              </li>
            ))}
            {canCreate && !filtered.includes(query.trim()) && (
              <li>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-accent hover:bg-accent/10"
                  onClick={() => addTag(query)}
                >
                  Create “{query.trim()}”
                </button>
              </li>
            )}
            {filtered.length === 0 && !canCreate && (
              <li className="px-2 py-1.5 text-xs text-text-muted">No tags</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
