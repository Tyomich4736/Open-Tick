import { BrowserWindow, shell, app } from 'electron'
import {
  applyDesktopSettings,
  isMinimizeToTrayEnabled,
} from '../../desktop/desktopSettings'
import { setMainWindowRef, getMainWindowRef } from '../../desktop/mainWindowRef'
import {
  DEFAULT_BOUNDS,
  loadMainWindowState,
  resetMainWindowState,
  saveMainWindowBounds,
  saveMainWindowMaximized,
} from '../../windows/mainWindowState'
import { appIconPath, preloadScriptPath, rendererHtmlPath } from '../../paths'
import { closeQuickCaptureWindow } from '../../windows/quickCaptureWindow'
import { runIpcHandler } from '../ipcWrapper'
import type { IpcResult } from '@shared/ipc-types'

let saveBoundsTimer: ReturnType<typeof setTimeout> | null = null
let allowQuit = false

export function setAllowQuit(value: boolean): void {
  allowQuit = value
}

function persistBounds(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMaximized()) return
  const b = win.getBounds()
  saveMainWindowBounds({ x: b.x, y: b.y, width: b.width, height: b.height })
}

function schedulePersistBounds(win: BrowserWindow): void {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer)
  saveBoundsTimer = setTimeout(() => persistBounds(win), 400)
}

export function createMainWindow(): BrowserWindow {
  const { bounds, maximized } = loadMainWindowState()

  const mainWindow = new BrowserWindow({
    width: bounds?.width ?? DEFAULT_BOUNDS.width,
    height: bounds?.height ?? DEFAULT_BOUNDS.height,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'TickTick Clone',
    icon: appIconPath(),
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (maximized) mainWindow.maximize()

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('resize', () => schedulePersistBounds(mainWindow))
  mainWindow.on('move', () => schedulePersistBounds(mainWindow))
  mainWindow.on('maximize', () => saveMainWindowMaximized(true))
  mainWindow.on('unmaximize', () => {
    saveMainWindowMaximized(false)
    schedulePersistBounds(mainWindow)
  })

  mainWindow.on('close', (event) => {
    if (allowQuit) return
    if (isMinimizeToTrayEnabled()) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('closed', () => {
    setMainWindowRef(null)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(rendererHtmlPath())
  }

  setMainWindowRef(mainWindow)
  return mainWindow
}

export function showOrCreateMainWindow(): BrowserWindow {
  const existing = getMainWindowRef()
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return existing
  }
  return createMainWindow()
}

export function handleDesktopApplySettings(): IpcResult<{ errors: string[] }> {
  return runIpcHandler(() => applyDesktopSettings())
}

export function handleDesktopResetWindow(): IpcResult<void> {
  return runIpcHandler(() => {
    resetMainWindowState()
    const win = getMainWindowRef()
    if (win) {
      win.unmaximize()
      win.setBounds({
        width: DEFAULT_BOUNDS.width,
        height: DEFAULT_BOUNDS.height,
      })
      win.center()
    }
  })
}

export function handleCloseQuickCapture(): IpcResult<void> {
  return runIpcHandler(() => {
    closeQuickCaptureWindow()
  })
}
