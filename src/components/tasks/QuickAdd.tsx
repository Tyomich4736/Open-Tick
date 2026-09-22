import { useEffect, useRef } from 'react'
import { Plus } from 'lucide-react'
import { useUiStore } from '@/stores/uiStore'

interface QuickAddProps {
  placeholder: string
  onSubmit: (title: string) => void
  disabled?: boolean
}

export function QuickAdd({ placeholder, onSubmit, disabled }: QuickAddProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const focusToken = useUiStore((s) => s.quickAddFocusToken)

  useEffect(() => {
    if (focusToken > 0) inputRef.current?.focus()
  }, [focusToken])

  return (
    <form
      className="border-b border-border bg-bg-sidebar/60 px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault()
        const title = inputRef.current?.value.trim()
        if (!title) return
        onSubmit(title)
        if (inputRef.current) inputRef.current.value = ''
      }}
    >
      <label className="flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-bg-primary px-3 py-2.5 shadow-sm focus-within:border-accent focus-within:shadow-none">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Plus className="size-3.5" strokeWidth={2.5} />
        </span>
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted disabled:opacity-50"
        />
        <kbd className="hidden shrink-0 rounded border border-border bg-bg-sidebar px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline">
          Enter
        </kbd>
      </label>
    </form>
  )
}
