import { app, BrowserWindow, screen, shell } from 'electron'
import type { StickyNote } from '@shared/entities'
import { getRepositories } from '../db/connection'
import { STICKY_DEFAULTS } from '../db/repositories/StickyNoteRepository'
import { appIconPath, preloadScriptPath, rendererHtmlPath } from '../paths'

const openWindows = new Map<string, BrowserWindow>()
let isAppQuitting = false
const MAX_STICKIES = 12

export function setStickyAppQuitting(quitting: boolean): void {
  isAppQuitting = quitting
}

function clampBounds(sticky: StickyNote): {
  x: number
  y: number
  width: number
  height: number
} {
  const width = Math.min(
    STICKY_DEFAULTS.maxWidth,
    Math.max(STICKY_DEFAULTS.minWidth, Math.round(sticky.width)),
  )
  const height = Math.min(
    STICKY_DEFAULTS.maxHeight,
    Math.max(STICKY_DEFAULTS.minHeight, Math.round(sticky.height)),
  )

  const display = screen.getDisplayNearestPoint({
    x: Math.round(sticky.window_x),
    y: Math.round(sticky.window_y),
  })
  const { workArea } = display
  const x = Math.min(
    workArea.x + workArea.width - 80,
    Math.max(workArea.x, Math.round(sticky.window_x)),
  )
  const y = Math.min(
    workArea.y + workArea.height - 40,
    Math.max(workArea.y, Math.round(sticky.window_y)),
  )
  return { x, y, width, height }
}

function loadStickyRoute(win: BrowserWindow, taskId: string) {
  const route = `/sticky/${encodeURIComponent(taskId)}`
  const qs = `window=sticky&taskId=${encodeURIComponent(taskId)}`

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

function applyPinned(win: BrowserWindow, pinned: boolean): void {
  if (win.isDestroyed()) return
  // Do not use level 'floating' — it has frozen Windows DWM with Electron.
  win.setAlwaysOnTop(pinned)
}

export function openStickyWindow(taskId: string): StickyNote {
  const repos = getRepositories()
  const task = repos.tasks.getById(taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  const sticky = repos.stickies.openForTask(taskId)
  const existing = openWindows.get(taskId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return sticky
  }

  if (openWindows.size >= MAX_STICKIES) {
    throw new Error(`Too many sticky notes open (max ${MAX_STICKIES})`)
  }

  const bounds = clampBounds(sticky)
  const win = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: STICKY_DEFAULTS.minWidth,
    minHeight: STICKY_DEFAULTS.minHeight,
    maxWidth: STICKY_DEFAULTS.maxWidth,
    maxHeight: STICKY_DEFAULTS.maxHeight,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    skipTaskbar: false,
    alwaysOnTop: false,
    hasShadow: true,
    roundedCorners: true,
    title: task.title || 'Sticky note',
    icon: appIconPath(),
    backgroundColor: sticky.color ?? '#fff59d',
    webPreferences: {
      preload: preloadScriptPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
      spellcheck: false,
    },
  })

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  const persistBounds = () => {
    if (win.isDestroyed()) return
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      if (win.isDestroyed()) return
      const [x, y] = win.getPosition()
      const [width, height] = win.getSize()
      try {
        getRepositories().stickies.updateBounds(taskId, {
          window_x: x,
          window_y: y,
          width,
          height,
        })
      } catch {
        // ignore
      }
    }, 300)
  }

  win.on('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.show()
    if (sticky.is_pinned) applyPinned(win, true)
  })

  win.on('moved', persistBounds)
  win.on('resized', persistBounds)

  win.on('closed', () => {
    if (persistTimer) clearTimeout(persistTimer)
    openWindows.delete(taskId)
    if (!isAppQuitting) {
      try {
        getRepositories().stickies.close(taskId)
      } catch {
        // ignore
      }
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Sticky renderer gone', taskId, details)
  })

  loadStickyRoute(win, taskId)
  openWindows.set(taskId, win)
  return sticky
}

export function closeStickyWindow(taskId: string): void {
  const win = openWindows.get(taskId)
  if (win && !win.isDestroyed()) {
    win.close()
  } else {
    openWindows.delete(taskId)
    getRepositories().stickies.close(taskId)
  }
}

export function setStickyPinned(taskId: string, isPinned: boolean): StickyNote {
  const sticky = getRepositories().stickies.setPinned(taskId, isPinned)
  const win = openWindows.get(taskId)
  if (win && !win.isDestroyed()) {
    applyPinned(win, isPinned)
  }
  return sticky
}

export function getOpenStickyWindow(taskId: string): BrowserWindow | undefined {
  const win = openWindows.get(taskId)
  if (win && !win.isDestroyed()) return win
  return undefined
}

export function restoreStickyWindows(): void {
  const stickies = getRepositories().stickies.list().slice(0, MAX_STICKIES)
  stickies.forEach((sticky, index) => {
    setTimeout(() => {
      if (isAppQuitting) return
      try {
        openStickyWindow(sticky.task_id)
      } catch (error) {
        console.error('Failed to restore sticky', sticky.task_id, error)
        try {
          getRepositories().stickies.close(sticky.task_id)
        } catch {
          // ignore
        }
      }
    }, index * 150)
  })
}
