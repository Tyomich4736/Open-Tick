import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useViewportMenuPosition } from '@/hooks/useViewportMenuPosition'
import { useUiStore } from '@/stores/uiStore'

export type TaskMenuSubmenu = 'date' | 'priority' | 'tags' | 'move' | null

interface TaskActionMenuShellProps {
  open: boolean
  x: number
  y: number
  children: (api: {
    submenu: TaskMenuSubmenu
    openSub: (next: TaskMenuSubmenu) => void
    scheduleCloseSub: () => void
    openLeft: boolean
    close: () => void
  }) => ReactNode
}

export function TaskActionMenuShell({ open, x, y, children }: TaskActionMenuShellProps) {
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const [submenu, setSubmenu] = useState<TaskMenuSubmenu>(null)
  const closeTimer = useRef<number | null>(null)
  const { ref, style } = useViewportMenuPosition(open, x, y, 220)

  useEffect(() => {
    setSubmenu(null)
  }, [x, y, open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, setContextMenu, ref])

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  if (!open) return null

  const openLeft = x > window.innerWidth - 420

  function close() {
    setContextMenu(null)
  }

  function openSub(next: TaskMenuSubmenu) {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setSubmenu(next)
  }

  function scheduleCloseSub() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setSubmenu(null), 120)
  }

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="fixed z-50 min-w-52 rounded-lg border border-border bg-bg-primary py-1 shadow-xl"
      onMouseLeave={scheduleCloseSub}
    >
      {children({ submenu, openSub, scheduleCloseSub, openLeft, close })}
    </div>,
    document.body,
  )
}
