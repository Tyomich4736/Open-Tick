import { Menu, Tray, nativeImage, screen, type NativeImage } from 'electron'
import { app } from 'electron'
import { trayIconPath } from './paths'
import { openQuickCaptureWindow } from './windows/quickCaptureWindow'
import { requestNewSticky } from './desktop/stickyActions'
import { getMainWindowRef, showMainWindow } from './desktop/mainWindowRef'
import { setAllowQuit } from './ipc/handlers/desktop'

let tray: Tray | null = null

function hideMainWindow(): void {
  const win = getMainWindowRef()
  if (!win) return
  win.hide()
}

function createTrayImage(): NativeImage {
  const path = trayIconPath()
  const icon = nativeImage.createFromPath(path)
  if (icon.isEmpty()) {
    console.error(`[tray] Failed to load icon from ${path}`)
    return nativeImage.createEmpty()
  }

  // .ico already contains 16/24/32… sizes — let Windows pick.
  if (path.toLowerCase().endsWith('.ico')) return icon

  const scale = screen.getPrimaryDisplay()?.scaleFactor || 1
  const size = Math.max(16, Math.round(16 * scale))
  return icon.resize({ width: size, height: size })
}

export function createAppTray(): Tray {
  if (tray && !tray.isDestroyed()) return tray

  tray = new Tray(createTrayImage())
  tray.setToolTip('Open Tick')

  const rebuildMenu = () => {
    const win = getMainWindowRef()
    const visible = Boolean(win && win.isVisible())
    const menu = Menu.buildFromTemplate([
      {
        label: visible ? 'Hide' : 'Show',
        click: () => {
          if (visible) hideMainWindow()
          else showMainWindow()
        },
      },
      {
        label: 'Quick Add',
        click: () => openQuickCaptureWindow(),
      },
      {
        label: 'New Sticky Note',
        click: () => requestNewSticky(),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          setAllowQuit(true)
          app.quit()
        },
      },
    ])
    tray?.setContextMenu(menu)
  }

  rebuildMenu()
  tray.on('double-click', () => showMainWindow())
  tray.on('click', () => rebuildMenu())

  return tray
}

export function destroyAppTray(): void {
  if (tray && !tray.isDestroyed()) tray.destroy()
  tray = null
}

export function showMainFromTray(): void {
  showMainWindow()
}
