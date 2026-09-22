import { app, globalShortcut } from 'electron'
import {
  DESKTOP_DEFAULTS,
  DESKTOP_SETTING_KEYS,
} from '@shared/desktopSettings'
import { getRepositories } from '../db/connection'
import { openQuickCaptureWindow } from '../windows/quickCaptureWindow'
import { requestNewSticky } from './stickyActions'
import { getMainWindowRef } from './mainWindowRef'
import { IPC_CHANNELS } from '@shared/channels'

let registeredShortcuts: string[] = []

export function applyAutoStart(): void {
  const enabled =
    getRepositories().settings.get<boolean>(DESKTOP_SETTING_KEYS.autoStart) ??
    DESKTOP_DEFAULTS.autoStart
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  })
}

export function isMinimizeToTrayEnabled(): boolean {
  return (
    getRepositories().settings.get<boolean>(DESKTOP_SETTING_KEYS.minimizeToTray) ??
    DESKTOP_DEFAULTS.minimizeToTray
  )
}

function unregisterAll(): void {
  for (const accel of registeredShortcuts) {
    try {
      globalShortcut.unregister(accel)
    } catch {
      /* ignore */
    }
  }
  registeredShortcuts = []
}

function registerOne(accel: string, action: () => void): string | null {
  if (!accel.trim()) return null
  try {
    const ok = globalShortcut.register(accel, action)
    if (!ok) return `Shortcut already in use: ${accel}`
    registeredShortcuts.push(accel)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : `Failed to register ${accel}`
  }
}

export function registerGlobalShortcuts(): { errors: string[] } {
  unregisterAll()
  const settings = getRepositories().settings
  const quick =
    settings.get<string>(DESKTOP_SETTING_KEYS.shortcutQuickCapture) ??
    DESKTOP_DEFAULTS.shortcutQuickCapture
  const sticky =
    settings.get<string>(DESKTOP_SETTING_KEYS.shortcutNewSticky) ??
    DESKTOP_DEFAULTS.shortcutNewSticky

  const errors: string[] = []
  const e1 = registerOne(quick, () => openQuickCaptureWindow())
  if (e1) errors.push(e1)
  const e2 = registerOne(sticky, () => requestNewSticky())
  if (e2) errors.push(e2)

  if (errors.length) {
    const main = getMainWindowRef()
    if (main && !main.isDestroyed()) {
      main.webContents.send(IPC_CHANNELS.DESKTOP_TOAST, {
        type: 'error',
        message: errors.join('; '),
      })
    }
  }

  return { errors }
}

export function applyDesktopSettings(): { errors: string[] } {
  applyAutoStart()
  return registerGlobalShortcuts()
}

export function stickyPinByDefault(): boolean {
  return (
    getRepositories().settings.get<boolean>(DESKTOP_SETTING_KEYS.stickyPinByDefault) ??
    DESKTOP_DEFAULTS.stickyPinByDefault
  )
}
