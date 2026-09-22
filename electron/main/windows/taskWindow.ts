import { app, BrowserWindow, shell } from 'electron'
import { appIconPath, preloadScriptPath, rendererHtmlPath } from '../paths'

const openWindows = new Map<string, BrowserWindow>()

export function openTaskWindow(taskId: string, title?: string): void {
  const existing = openWindows.get(taskId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 720,
    height: 800,
    minWidth: 500,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: title?.trim() || 'Task',
    icon: appIconPath(),
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    openWindows.delete(taskId)
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const route = `/task-window/${encodeURIComponent(taskId)}`
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${route}`)
  } else {
    void win.loadFile(rendererHtmlPath(), { hash: route })
  }

  openWindows.set(taskId, win)
}

export function closeTaskWindow(taskId: string): void {
  const win = openWindows.get(taskId)
  if (win && !win.isDestroyed()) win.close()
  openWindows.delete(taskId)
}

export function setTaskWindowTitle(taskId: string, title: string): void {
  const win = openWindows.get(taskId)
  if (win && !win.isDestroyed()) win.setTitle(title || 'Task')
}
