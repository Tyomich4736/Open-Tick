export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeSource = 'preset' | 'image' | 'custom'

export interface ThemeColors {
  bgPrimary: string
  bgSidebar: string
  textPrimary: string
  textSecondary: string
  accent: string
  border: string
  priorityLow: string
  priorityMedium: string
  priorityHigh: string
}

export interface AppearanceSettings {
  fontFamily: string
  fontSize: number
  themeMode: ThemeMode
  themeSource: ThemeSource
  presetId: string
  customColors: ThemeColors
  imageThemePath: string | null
  extractedPalette: ThemeColors | null
}

export interface ThemePreset {
  id: string
  name: string
  description: string
  light: ThemeColors
  dark: ThemeColors
}

export const DEFAULT_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

export const FONT_PRESETS: { id: string; label: string; value: string }[] = [
  { id: 'system', label: 'System default', value: DEFAULT_FONT_FAMILY },
  {
    id: 'segoe',
    label: 'Segoe UI',
    value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  {
    id: 'inter',
    label: 'Inter',
    value: "Inter, 'Segoe UI', Roboto, sans-serif",
  },
  {
    id: 'georgia',
    label: 'Georgia',
    value: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    value: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  },
  {
    id: 'source-serif',
    label: 'Source Serif',
    value: "'Source Serif 4', 'Iowan Old Style', 'Palatino Linotype', serif",
  },
]

export const DEFAULT_LIGHT_COLORS: ThemeColors = {
  bgPrimary: '#ffffff',
  bgSidebar: '#f7f7f7',
  textPrimary: '#191919',
  textSecondary: '#6b7280',
  accent: '#4772fa',
  border: '#e8e8e8',
  priorityLow: '#4772fa',
  priorityMedium: '#ffaf38',
  priorityHigh: '#fe7777',
}

export const DEFAULT_DARK_COLORS: ThemeColors = {
  bgPrimary: '#1a1a1a',
  bgSidebar: '#252525',
  textPrimary: '#f0f0f0',
  textSecondary: '#9ca3af',
  accent: '#6b8aff',
  border: '#333333',
  priorityLow: '#6b8aff',
  priorityMedium: '#ffaf38',
  priorityHigh: '#fe7777',
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Clean TickTick-inspired blue',
    light: DEFAULT_LIGHT_COLORS,
    dark: DEFAULT_DARK_COLORS,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep navy surfaces',
    light: {
      bgPrimary: '#f4f6fb',
      bgSidebar: '#e8edf7',
      textPrimary: '#152238',
      textSecondary: '#5b6b85',
      accent: '#3d5afe',
      border: '#d0d8e8',
      priorityLow: '#3d5afe',
      priorityMedium: '#f0a202',
      priorityHigh: '#e4572e',
    },
    dark: {
      bgPrimary: '#0d1526',
      bgSidebar: '#152238',
      textPrimary: '#e8eefc',
      textSecondary: '#8b9bb8',
      accent: '#7c9cff',
      border: '#243352',
      priorityLow: '#7c9cff',
      priorityMedium: '#f0a202',
      priorityHigh: '#ff6b4a',
    },
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Soft gray editorial',
    light: {
      bgPrimary: '#fafafa',
      bgSidebar: '#f0f0f0',
      textPrimary: '#222222',
      textSecondary: '#666666',
      accent: '#2f6fed',
      border: '#e2e2e2',
      priorityLow: '#2f6fed',
      priorityMedium: '#c98900',
      priorityHigh: '#d64545',
    },
    dark: {
      bgPrimary: '#161616',
      bgSidebar: '#1f1f1f',
      textPrimary: '#ececec',
      textSecondary: '#a0a0a0',
      accent: '#6b9bff',
      border: '#2e2e2e',
      priorityLow: '#6b9bff',
      priorityMedium: '#e0a800',
      priorityHigh: '#ff6b6b',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Teal and seafoam',
    light: {
      bgPrimary: '#f3faf9',
      bgSidebar: '#e4f3f0',
      textPrimary: '#0f2f2c',
      textSecondary: '#4d736e',
      accent: '#0d9488',
      border: '#c9e4df',
      priorityLow: '#0d9488',
      priorityMedium: '#d97706',
      priorityHigh: '#e11d48',
    },
    dark: {
      bgPrimary: '#0b1c1a',
      bgSidebar: '#12302c',
      textPrimary: '#e7f7f4',
      textSecondary: '#8bb5ae',
      accent: '#2dd4bf',
      border: '#1e4540',
      priorityLow: '#2dd4bf',
      priorityMedium: '#fbbf24',
      priorityHigh: '#fb7185',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Moss and pine',
    light: {
      bgPrimary: '#f6f8f4',
      bgSidebar: '#e8eee3',
      textPrimary: '#1a2a1a',
      textSecondary: '#5a6b58',
      accent: '#3f7d4e',
      border: '#d2ddd0',
      priorityLow: '#3f7d4e',
      priorityMedium: '#c47d1a',
      priorityHigh: '#c23b3b',
    },
    dark: {
      bgPrimary: '#121a12',
      bgSidebar: '#1b271b',
      textPrimary: '#e8f0e6',
      textSecondary: '#93a890',
      accent: '#6dba7c',
      border: '#2a3a2a',
      priorityLow: '#6dba7c',
      priorityMedium: '#e0a040',
      priorityHigh: '#ef6b6b',
    },
  },
  {
    id: 'high-contrast',
    name: 'High contrast',
    description: 'Maximum readability',
    light: {
      bgPrimary: '#ffffff',
      bgSidebar: '#f0f0f0',
      textPrimary: '#000000',
      textSecondary: '#333333',
      accent: '#0050ff',
      border: '#000000',
      priorityLow: '#0050ff',
      priorityMedium: '#b36b00',
      priorityHigh: '#c00000',
    },
    dark: {
      bgPrimary: '#000000',
      bgSidebar: '#121212',
      textPrimary: '#ffffff',
      textSecondary: '#cccccc',
      accent: '#66a3ff',
      border: '#ffffff',
      priorityLow: '#66a3ff',
      priorityMedium: '#ffc14d',
      priorityHigh: '#ff6666',
    },
  },
]

export const APPEARANCE_KEYS = {
  fontFamily: 'appearance.font_family',
  fontSize: 'appearance.font_size',
  themeMode: 'appearance.theme_mode',
  themeSource: 'appearance.theme_source',
  presetId: 'appearance.preset_id',
  customColors: 'appearance.custom_colors',
  imageThemePath: 'appearance.image_theme_path',
  extractedPalette: 'appearance.extracted_palette',
} as const

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]
}

export function defaultAppearance(): AppearanceSettings {
  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontSize: 14,
    themeMode: 'system',
    themeSource: 'preset',
    presetId: 'default',
    customColors: { ...DEFAULT_LIGHT_COLORS },
    imageThemePath: null,
    extractedPalette: null,
  }
}

export function resolveThemeColors(
  appearance: AppearanceSettings,
  resolvedMode: 'light' | 'dark',
): ThemeColors {
  if (appearance.themeSource === 'custom') {
    return appearance.customColors
  }
  if (appearance.themeSource === 'image' && appearance.extractedPalette) {
    return appearance.extractedPalette
  }
  const preset = getPreset(appearance.presetId)
  return resolvedMode === 'dark' ? preset.dark : preset.light
}

/** Relative luminance for WCAG contrast checks */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA)
  const l2 = relativeLuminance(hexB)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function darkenHex(hex: string, amount = 0.12): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const [r, g, b] = rgb.map((c) => Math.max(0, Math.round(c * (1 - amount))))
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function parseHex(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace('#', '')
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16)
    const g = parseInt(cleaned[1] + cleaned[1], 16)
    const b = parseInt(cleaned[2] + cleaned[2], 16)
    if ([r, g, b].some(Number.isNaN)) return null
    return [r, g, b]
  }
  if (cleaned.length !== 6) return null
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return [r, g, b]
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, '0')
}
