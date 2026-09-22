import { Menu, Tray, nativeImage } from 'electron'
import { app } from 'electron'
import { appIconPath } from './paths'
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

export function createAppTray(): Tray {
  if (tray && !tray.isDestroyed()) return tray

  const icon = nativeImage.createFromPath(appIconPath())
  tray = new Tray(
    icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }),
  )
  tray.setToolTip('TickTick Clone')

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
