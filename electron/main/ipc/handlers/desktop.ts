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

  // Windows: show immediately (ready-to-show alone left zombies when load stalled).
  // Linux: wait for first paint — showing a blank AppImage/Wayland window looks frozen.
  const showImmediately = process.platform === 'win32'

  const mainWindow = new BrowserWindow({
    width: bounds?.width ?? DEFAULT_BOUNDS.width,
    height: bounds?.height ?? DEFAULT_BOUNDS.height,
    ...(bounds ? { x: bounds.x, y: bounds.y } : {}),
    minWidth: 900,
    minHeight: 600,
    show: showImmediately,
    autoHideMenuBar: true,
    title: 'Open Tick',
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
  if (showImmediately) mainWindow.focus()

  if (!showImmediately) {
    let revealed = false
    const reveal = () => {
      if (revealed || mainWindow.isDestroyed()) return
      revealed = true
      revealMainWindow(mainWindow)
    }
    mainWindow.once('ready-to-show', reveal)
    // FUSE/AppImage loads can stall; never leave a hidden process with no window.
    setTimeout(reveal, 8000)
  }

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
    // Only open real external links (markdown, OAuth, etc.). In-app hash
    // navigations from Ctrl/Cmd+click on <a href="#/..."> must stay inside Electron.
    if (/^https?:\/\//i.test(details.url)) {
      void shell.openExternal(details.url)
    }
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
