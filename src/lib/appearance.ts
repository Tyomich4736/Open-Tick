import {
  darkenHex,
  defaultAppearance,
  resolveThemeColors,
  type AppearanceSettings,
  type ThemeMode,
} from '@shared/appearance'

function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export function applyAppearance(appearance: AppearanceSettings): void {
  const root = document.documentElement
  const resolved = resolveMode(appearance.themeMode)
  const colors = resolveThemeColors(appearance, resolved)

  root.dataset.theme = resolved
  root.style.setProperty('--font-family', appearance.fontFamily)
  root.style.setProperty('--font-size-base', `${appearance.fontSize}px`)
  root.style.setProperty('--color-bg-primary', colors.bgPrimary)
  root.style.setProperty('--color-bg-sidebar', colors.bgSidebar)
  root.style.setProperty('--color-text-primary', colors.textPrimary)
  root.style.setProperty('--color-text-muted', colors.textSecondary)
  root.style.setProperty('--color-accent', colors.accent)
  root.style.setProperty('--color-accent-hover', darkenHex(colors.accent, 0.1))
  root.style.setProperty('--color-border', colors.border)
  root.style.setProperty('--color-priority-low', colors.priorityLow)
  root.style.setProperty('--color-priority-medium', colors.priorityMedium)
  root.style.setProperty('--color-priority-high', colors.priorityHigh)
}

export function getResolvedThemeMode(mode: ThemeMode): 'light' | 'dark' {
  return resolveMode(mode)
}

export { defaultAppearance }
