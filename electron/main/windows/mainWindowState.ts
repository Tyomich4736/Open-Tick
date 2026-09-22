import { DESKTOP_SETTING_KEYS, type WindowBounds } from '@shared/desktopSettings'
import { getRepositories } from '../db/connection'

const DEFAULT_BOUNDS = { width: 1200, height: 800 }

export function loadMainWindowState(): {
  bounds: WindowBounds | null
  maximized: boolean
} {
  const settings = getRepositories().settings
  const bounds = settings.get<WindowBounds>(DESKTOP_SETTING_KEYS.windowBounds)
  const maximized = settings.get<boolean>(DESKTOP_SETTING_KEYS.windowMaximized) ?? false
  return {
    bounds:
      bounds &&
      typeof bounds.x === 'number' &&
      typeof bounds.y === 'number' &&
      typeof bounds.width === 'number' &&
      typeof bounds.height === 'number'
        ? bounds
        : null,
    maximized,
  }
}

export function saveMainWindowBounds(bounds: WindowBounds): void {
  getRepositories().settings.set(DESKTOP_SETTING_KEYS.windowBounds, bounds)
}

export function saveMainWindowMaximized(maximized: boolean): void {
  getRepositories().settings.set(DESKTOP_SETTING_KEYS.windowMaximized, maximized)
}

export function resetMainWindowState(): void {
  getRepositories().settings.set(DESKTOP_SETTING_KEYS.windowBounds, null)
  getRepositories().settings.set(DESKTOP_SETTING_KEYS.windowMaximized, false)
}

export { DEFAULT_BOUNDS }
