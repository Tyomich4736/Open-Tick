import { useCallback, useRef } from 'react'

interface ResizeHandleProps {
  /** Horizontal divider between left and right panes */
  onResize: (deltaX: number) => void
  onReset?: () => void
  /** When true, dragging right increases the left pane; when false, dragging right shrinks the right pane (invert) */
  invert?: boolean
  /** Fired when a drag starts / ends so parents can disable CSS width transitions */
  onDraggingChange?: (dragging: boolean) => void
  'aria-label'?: string
}

export function ResizeHandle({
  onResize,
  onReset,
  invert = false,
  onDraggingChange,
  'aria-label': ariaLabel = 'Resize panel',
}: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      dragging.current = true
      lastX.current = e.clientX
      e.currentTarget.setPointerCapture(e.pointerId)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      onDraggingChange?.(true)
    },
    [onDraggingChange],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      if (delta !== 0) onResize(invert ? -delta : delta)
    },
    [invert, onResize],
  )

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      dragging.current = false
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // already released
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onDraggingChange?.(false)
    },
    [onDraggingChange],
  )

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onReset?.()}
      className="group relative z-20 w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/40 active:bg-accent/50"
    >
      <div className="pointer-events-none absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  )
}
