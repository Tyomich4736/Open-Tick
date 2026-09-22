import type Database from 'better-sqlite3'
import {
  APPEARANCE_KEYS,
  DEFAULT_FONT_FAMILY,
  DEFAULT_LIGHT_COLORS,
  type AppearanceSettings,
  type ThemeColors,
  type ThemeMode,
  type ThemeSource,
} from '@shared/appearance'

export const migration003 = {
  version: 3,
  up(db: Database.Database): void {
    const get = (key: string): string | null => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
        | { value: string }
        | undefined
      return row?.value ?? null
    }

    const set = (key: string, value: unknown): void => {
      db.prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ).run(key, JSON.stringify(value))
    }

    if (get(APPEARANCE_KEYS.themeMode) == null) {
      const legacy = get('theme')
      let mode: ThemeMode = 'system'
      if (legacy) {
        try {
          mode = JSON.parse(legacy) as ThemeMode
        } catch {
          mode = 'system'
        }
      }
      set(APPEARANCE_KEYS.themeMode, mode)
    }

    if (get(APPEARANCE_KEYS.fontFamily) == null) set(APPEARANCE_KEYS.fontFamily, DEFAULT_FONT_FAMILY)
    if (get(APPEARANCE_KEYS.fontSize) == null) set(APPEARANCE_KEYS.fontSize, 14)
    if (get(APPEARANCE_KEYS.themeSource) == null) set(APPEARANCE_KEYS.themeSource, 'preset')
    if (get(APPEARANCE_KEYS.presetId) == null) set(APPEARANCE_KEYS.presetId, 'default')
    if (get(APPEARANCE_KEYS.customColors) == null) {
      set(APPEARANCE_KEYS.customColors, DEFAULT_LIGHT_COLORS)
    }
    if (get(APPEARANCE_KEYS.imageThemePath) == null) set(APPEARANCE_KEYS.imageThemePath, null)
    if (get(APPEARANCE_KEYS.extractedPalette) == null) {
      set(APPEARANCE_KEYS.extractedPalette, null)
    }
  },
}

export function readAppearanceSettings(db: Database.Database): AppearanceSettings {
  const get = <T>(key: string, fallback: T): T => {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row) return fallback
    try {
      return JSON.parse(row.value) as T
    } catch {
      return fallback
    }
  }

  return {
    fontFamily: get(APPEARANCE_KEYS.fontFamily, DEFAULT_FONT_FAMILY),
    fontSize: get(APPEARANCE_KEYS.fontSize, 14),
    themeMode: get<ThemeMode>(APPEARANCE_KEYS.themeMode, 'system'),
    themeSource: get<ThemeSource>(APPEARANCE_KEYS.themeSource, 'preset'),
    presetId: get(APPEARANCE_KEYS.presetId, 'default'),
    customColors: get<ThemeColors>(APPEARANCE_KEYS.customColors, DEFAULT_LIGHT_COLORS),
    imageThemePath: get<string | null>(APPEARANCE_KEYS.imageThemePath, null),
    extractedPalette: get<ThemeColors | null>(APPEARANCE_KEYS.extractedPalette, null),
  }
}
