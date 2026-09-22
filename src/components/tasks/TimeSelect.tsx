import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { TimeFormat } from '@/hooks/useTimeFormat'
import {
  formatTimeLabel,
  halfHourTimeSlots,
  parseTypedTime,
} from '@/lib/formatDueDate'

interface TimeSelectProps {
  value: string // HH:mm
  onChange: (value: string) => void
  timeFormat: TimeFormat
  disabled?: boolean
  /** Smaller padding / type for tight layouts (e.g. duration start/end). */
  compact?: boolean
  className?: string
}

export function TimeSelect({
  value,
  onChange,
  timeFormat,
  disabled,
  compact,
  className,
}: TimeSelectProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => formatTimeLabel(value || '09:00', timeFormat))
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const suppressBlurCommit = useRef(false)
  const [listStyle, setListStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: 0,
    top: 0,
    visibility: 'hidden',
    zIndex: 80,
  })

  const slots = useMemo(() => halfHourTimeSlots(), [])

  useEffect(() => {
    setText(formatTimeLabel(value || '09:00', timeFormat))
  }, [value, timeFormat])

  useLayoutEffect(() => {
    if (!open) return

    function place() {
      const input = inputRef.current
      if (!input) return
      const rect = input.getBoundingClientRect()
      const margin = 8
      const maxHeight = 176 // max-h-44
      const spaceBelow = window.innerHeight - rect.bottom - margin
      const spaceAbove = rect.top - margin
      const openUp = spaceBelow < 120 && spaceAbove > spaceBelow
      const height = Math.min(maxHeight, openUp ? spaceAbove : spaceBelow)

      let left = rect.left
      const width = Math.max(rect.width, compact ? 88 : 112)
      if (left + width > window.innerWidth - margin) {
        left = Math.max(margin, window.innerWidth - width - margin)
      }

      setListStyle({
        position: 'fixed',
        left,
        width,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        maxHeight: height,
        zIndex: 80,
        visibility: 'visible',
      })
    }

    function onScroll(e: Event) {
      // Ignore scrolls inside the dropdown — otherwise place() + scrollIntoView fight the user.
      const target = e.target
      if (target instanceof Node && listRef.current?.contains(target)) return
      place()
    }

    place()
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, compact])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (!open) return
    // Scroll to the active slot once when the menu opens — not on every style update.
    const id = window.requestAnimationFrame(() => {
      const active = listRef.current?.querySelector('[data-active="true"]')
      active?.scrollIntoView({ block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [open])

  const commit = (raw: string) => {
    const parsed = parseTypedTime(raw)
    if (parsed) {
      onChange(parsed)
      setText(formatTimeLabel(parsed, timeFormat))
    } else {
      setText(formatTimeLabel(value || '09:00', timeFormat))
    }
    setOpen(false)
  }

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q || q === formatTimeLabel(value || '09:00', timeFormat).toLowerCase()) return slots
    return slots.filter((slot) => formatTimeLabel(slot, timeFormat).toLowerCase().includes(q))
  }, [text, slots, timeFormat, value])

  return (
    <div ref={rootRef} className={['relative w-full min-w-0', className].filter(Boolean).join(' ')}>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={text}
        placeholder={timeFormat === '24h' ? '09:00' : '9:00 AM'}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(text)
          }
          if (e.key === 'Escape') {
            setText(formatTimeLabel(value || '09:00', timeFormat))
            setOpen(false)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (suppressBlurCommit.current) {
              suppressBlurCommit.current = false
              return
            }
            if (
              !rootRef.current?.contains(document.activeElement) &&
              !listRef.current?.contains(document.activeElement)
            ) {
              commit(text)
            }
          }, 120)
        }}
        className={[
          'w-full min-w-0 rounded-lg border border-border bg-bg-primary text-text-primary outline-none focus:border-accent disabled:opacity-50',
          compact ? 'px-1.5 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
        ].join(' ')}
      />

      {open &&
        !disabled &&
        createPortal(
          <ul
            ref={listRef}
            data-anchored-layer=""
            style={listStyle}
            className={[
              'overflow-y-auto rounded-lg border border-border bg-bg-primary py-1 shadow-lg',
              compact ? 'text-xs' : 'text-sm',
            ].join(' ')}
          >
            {filtered.map((slot) => {
              const label = formatTimeLabel(slot, timeFormat)
              const active = slot === (value || '09:00')
              return (
                <li key={slot}>
                  <button
                    type="button"
                    data-active={active ? 'true' : undefined}
                    className={[
                      'w-full text-left',
                      compact ? 'px-2 py-1' : 'px-3 py-1.5',
                      active
                        ? 'bg-accent/10 font-medium text-accent'
                        : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5',
                    ].join(' ')}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      suppressBlurCommit.current = true
                    }}
                    onClick={() => {
                      onChange(slot)
                      setText(label)
                      setOpen(false)
                      suppressBlurCommit.current = false
                    }}
                  >
                    {label}
                  </button>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="px-2 py-2 text-xs text-text-muted">Press Enter to use “{text}”</li>
            )}
          </ul>,
          document.body,
        )}
    </div>
  )
}
