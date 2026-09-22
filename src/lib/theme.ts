import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import type { ThemeMode } from '@shared/appearance'
import { applyAppearance } from './appearance'

/** @deprecated Prefer appearance.themeMode via useAppearance */
export async function loadThemeSetting(): Promise<ThemeMode> {
  const appearance = await ipc.settings.getAppearance()
  if (appearance.ok) return appearance.data.themeMode
  const legacy = await ipc.settings.get<ThemeMode>('theme')
  return legacy.ok && legacy.data ? legacy.data : 'system'
}

/** @deprecated Prefer updateAppearance({ themeMode }) */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  const appearance = unwrapIpc(await ipc.settings.setAppearance({ themeMode: mode }))
  applyAppearance(appearance)
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.dataset.theme =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode
}

export function getResolvedTheme(): 'light' | 'dark' {
  return (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light'
}

/**
 * Resolve list/project color for task chrome.
 * Empty string (Inbox) → null so the list bar stays uncolored.
 */
export function resolveProjectColor(projectColor: string | null | undefined): string | null {
  const trimmed = projectColor?.trim()
  return trimmed ? trimmed : null
}

/** Soft fill from a solid `#rrggbb` project color. */
export function projectColorWash(projectColor: string | null | undefined, alphaHex = '33'): string | null {
  const color = resolveProjectColor(projectColor)
  if (!color) return null
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}${alphaHex}`
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const [r, g, b] = color.slice(1)
    return `#${r}${r}${g}${g}${b}${b}${alphaHex}`
  }
  return color
}

export type CalendarTaskChrome = {
  project_color: string
  project_is_inbox?: boolean
}

/**
 * Calendar chip styles: solid list color, or dashed accent for Inbox
 * so undated-list tasks stay visible without a list color bar.
 */
export function calendarTaskChromeStyle(
  task: CalendarTaskChrome,
  opts?: { washAlpha?: string; borderWidth?: number },
): React.CSSProperties {
  const washAlpha = opts?.washAlpha ?? '33'
  const borderWidth = opts?.borderWidth ?? 2
  const solid = resolveProjectColor(task.project_color)
  const inbox = task.project_is_inbox || !solid

  if (inbox) {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
      borderLeft: `${borderWidth}px dashed var(--color-accent)`,
    }
  }

  return {
    backgroundColor: projectColorWash(solid, washAlpha) ?? undefined,
    borderLeft: `${borderWidth}px solid ${solid}`,
  }
}

/** Dot / bullet for agenda & month footers. */
export function calendarTaskDotStyle(task: CalendarTaskChrome): React.CSSProperties {
  const solid = resolveProjectColor(task.project_color)
  if (task.project_is_inbox || !solid) {
    return {
      backgroundColor: 'transparent',
      boxShadow: 'inset 0 0 0 1.5px var(--color-accent)',
    }
  }
  return { backgroundColor: solid }
}
