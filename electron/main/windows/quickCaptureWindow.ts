import { app, BrowserWindow, screen } from 'electron'
import { appIconPath, preloadScriptPath, rendererHtmlPath } from '../paths'

let captureWindow: BrowserWindow | null = null

function loadQuickCaptureRoute(win: BrowserWindow): void {
  const route = '/quick-capture'
  const qs = 'window=quick-capture'

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
    void win.loadURL(`${base}/?${qs}#${route}`)
  } else {
    void win.loadFile(rendererHtmlPath(), {
      search: qs,
      hash: route,
    })
  }
}

export function openQuickCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show()
    captureWindow.focus()
    return
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const width = 420
  const height = 72
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  const y = Math.round(display.workArea.y + display.workArea.height * 0.22)

  captureWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    title: 'Quick Add',
    icon: appIconPath(),
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  captureWindow.setAlwaysOnTop(true)
  captureWindow.on('blur', () => {
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.hide()
    }
  })
  captureWindow.on('closed', () => {
    captureWindow = null
  })
  captureWindow.on('ready-to-show', () => {
    captureWindow?.show()
    captureWindow?.focus()
  })

  loadQuickCaptureRoute(captureWindow)
}

export function closeQuickCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close()
  }
  captureWindow = null
}
