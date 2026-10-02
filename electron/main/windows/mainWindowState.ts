import { screen } from 'electron'
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
  const raw =
    bounds &&
    typeof bounds.x === 'number' &&
    typeof bounds.y === 'number' &&
    typeof bounds.width === 'number' &&
    typeof bounds.height === 'number'
      ? bounds
      : null

  return {
    bounds: raw ? clampWindowBounds(raw) : null,
    maximized,
  }
}

/**
 * Keep the window on a visible display. Saved bounds from a disconnected
 * monitor otherwise leave the app running with no visible window on Windows.
 */
export function clampWindowBounds(bounds: WindowBounds): WindowBounds {
  const width = Math.max(900, Math.round(bounds.width) || DEFAULT_BOUNDS.width)
  const height = Math.max(600, Math.round(bounds.height) || DEFAULT_BOUNDS.height)

  const display = screen.getDisplayNearestPoint({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
  })
  const { workArea } = display

  // If the stored point isn't on any real work area, fall back to primary.
  const onScreen =
    bounds.x + width > workArea.x + 40 &&
    bounds.y + height > workArea.y + 40 &&
    bounds.x < workArea.x + workArea.width - 40 &&
    bounds.y < workArea.y + workArea.height - 40

  const area = onScreen ? workArea : screen.getPrimaryDisplay().workArea
  const x = Math.min(
    area.x + area.width - Math.min(width, area.width),
    Math.max(area.x, Math.round(bounds.x)),
  )
  const y = Math.min(
    area.y + area.height - Math.min(height, area.height),
    Math.max(area.y, Math.round(bounds.y)),
  )

  return {
    x,
    y,
    width: Math.min(width, area.width),
    height: Math.min(height, area.height),
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
