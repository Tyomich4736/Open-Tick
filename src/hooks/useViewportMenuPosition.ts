import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'

/**
 * Positions a fixed menu inside the viewport (HTML menus cannot leave the
 * BrowserWindow). Flips above the cursor when near the bottom; clamps and
 * scrolls when the menu is taller than the window.
 */
export function useViewportMenuPosition(
  open: boolean,
  x: number,
  y: number,
  estimatedWidth = 220,
): { ref: RefObject<HTMLDivElement | null>; style: CSSProperties } {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: x,
    top: y,
    visibility: 'hidden',
    zIndex: 1000,
  })

  useLayoutEffect(() => {
    if (!open) return

    function place() {
      const el = ref.current
      if (!el) return

      const margin = 8
      const w = el.offsetWidth || estimatedWidth
      const h = el.offsetHeight || 280

      let left = x
      if (left + w > window.innerWidth - margin) {
        left = window.innerWidth - w - margin
      }
      left = Math.max(margin, left)

      let top = y
      if (top + h > window.innerHeight - margin) {
        const above = y - h
        top = above >= margin ? above : margin
      }
      top = Math.max(margin, Math.min(top, window.innerHeight - margin))

      const maxHeight = Math.max(120, window.innerHeight - top - margin)

      setStyle({
        position: 'fixed',
        left,
        top,
        zIndex: 1000,
        visibility: 'visible',
        maxHeight,
        overflowY: h > maxHeight ? 'auto' : undefined,
      })
    }

    place()
    // Re-measure after fonts/submenu layout
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
    }
  }, [open, x, y, estimatedWidth])

  return { ref, style }
}
