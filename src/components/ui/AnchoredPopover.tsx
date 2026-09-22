import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { isInsideAnchoredLayer } from './anchoredLayer'

interface AnchoredPopoverProps {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  /** Combined with anchor for outside-click detection */
  onClose: () => void
  children: ReactNode
  className?: string
  /** Preferred panel width used for horizontal clamping */
  width?: number
  /** Gap below/above the anchor */
  offset?: number
}

/**
 * Renders a fixed popover near an anchor, clamped to the viewport so it
 * never expands a scrollable parent (e.g. the detail panel).
 */
export function AnchoredPopover({
  open,
  anchorRef,
  onClose,
  children,
  className,
  width = 240,
  offset = 4,
}: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: 0,
    top: 0,
    visibility: 'hidden',
    zIndex: 60,
  })

  useLayoutEffect(() => {
    if (!open) return

    function place() {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      const panelWidth = panel?.offsetWidth || width
      const panelHeight = panel?.offsetHeight || 200
      const margin = 8

      let left = rect.left
      if (left + panelWidth > window.innerWidth - margin) {
        left = Math.max(margin, rect.right - panelWidth)
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin))

      let top = rect.bottom + offset
      if (top + panelHeight > window.innerHeight - margin) {
        const above = rect.top - offset - panelHeight
        top = above >= margin ? above : Math.max(margin, window.innerHeight - panelHeight - margin)
      }

      setStyle({
        position: 'fixed',
        left,
        top,
        zIndex: 60,
        visibility: 'visible',
        width: panel?.offsetWidth ? undefined : width,
      })
    }

    place()
    // Re-measure after paint once content sizes itself
    const raf = requestAnimationFrame(place)

    function onScroll(e: Event) {
      const target = e.target
      if (target instanceof Node && panelRef.current?.contains(target)) return
      if (isInsideAnchoredLayer(target)) return
      place()
    }

    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, anchorRef, width, offset])

  useLayoutEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      // TimeSelect (and similar) portals outside the panel DOM.
      if (isInsideAnchoredLayer(target)) return
      onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    // Capture so nested dialogs that stopPropagation on bubble still close us.
    // Defer so the opening click doesn't immediately close.
    const id = window.setTimeout(() => {
      window.addEventListener('mousedown', onPointerDown, true)
    }, 0)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('mousedown', onPointerDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div ref={panelRef} style={style} className={className}>
      {children}
    </div>,
    document.body,
  )
}
