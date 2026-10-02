import { BrowserWindow, shell, app } from 'electron'
import { join } from 'node:path'
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

function revealMainWindow(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

export function createMainWindow(): BrowserWindow {
  let bounds: ReturnType<typeof loadMainWindowState>['bounds'] = null
  let maximized = false
  try {
    ;({ bounds, maximized } = loadMainWindowState())
  } catch (err) {
    console.error('[window] loadMainWindowState failed, using defaults', err)
  }

  const mainWindow = new BrowserWindow({
    width: bounds?.width ?? DEFAULT_BOUNDS.width,
    height: bounds?.height ?? DEFAULT_BOUNDS.height,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 900,
    minHeight: 600,
    // Show immediately on Windows — waiting only on ready-to-show left zombie processes
    // when DB/native init or load stalled.
    show: true,
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

  if (!bounds) mainWindow.center()
  if (maximized) mainWindow.maximize()
  mainWindow.focus()

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[window] failed to load', { code, desc, url, html: rendererHtmlPath() })
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
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const html = rendererHtmlPath()
    void mainWindow.loadFile(html).catch((err) => {
      console.error('[window] loadFile failed', html, err)
      const fallback = join(app.getAppPath(), 'out', 'renderer', 'index.html')
      void mainWindow.loadFile(fallback)
    })
  }

  setMainWindowRef(mainWindow)
  return mainWindow
}

export function showOrCreateMainWindow(): BrowserWindow {
  const existing = getMainWindowRef()
  if (existing) {
    revealMainWindow(existing)
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
      win.show()
      win.focus()
    }
  })
}

export function handleCloseQuickCapture(): IpcResult<void> {
  return runIpcHandler(() => {
    closeQuickCaptureWindow()
  })
}
