import { useState } from 'react'
import { X } from 'lucide-react'

interface TagInputProps {
  value: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}

export function TagInput({ value, suggestions, onChange }: TagInputProps) {
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const tag = raw.trim()
    if (!tag || value.includes(tag)) return
    onChange([...value, tag])
    setInput('')
  }

  const filtered = suggestions.filter(
    (s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()),
  )

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              aria-label={`Remove ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addTag(input)
          }
        }}
        placeholder="Add tag and press Enter"
        className="mt-2 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
      />
      {input && filtered.length > 0 && (
        <ul className="mt-1 rounded-lg border border-border bg-bg-sidebar py-1">
          {filtered.slice(0, 5).map((tag) => (
            <li key={tag}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => addTag(tag)}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
