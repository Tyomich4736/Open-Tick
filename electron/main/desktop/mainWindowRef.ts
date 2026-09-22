import type { BrowserWindow } from 'electron'

let mainWindowRef: BrowserWindow | null = null

export function setMainWindowRef(win: BrowserWindow | null): void {
  mainWindowRef = win
}

export function getMainWindowRef(): BrowserWindow | null {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) return mainWindowRef
  return null
}

export function showMainWindow(): void {
  const win = getMainWindowRef()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
