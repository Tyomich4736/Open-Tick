import type Database from 'better-sqlite3'
import type { AppearanceSettings } from '@shared/appearance'
import { APPEARANCE_KEYS } from '@shared/appearance'
import { resolveTimezone, SYSTEM_TIMEZONE } from '@shared/timezone'
import { readAppearanceSettings } from '../migrations/003_appearance'

export class SettingsRepository {
  constructor(private db: Database.Database) {}

  get<T = unknown>(key: string): T | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    if (!row) return null
    return JSON.parse(row.value) as T
  }

  set(key: string, value: unknown): void {
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, JSON.stringify(value))

    // Keep legacy theme key in sync for older code paths
    if (key === APPEARANCE_KEYS.themeMode) {
      this.db
        .prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run('theme', JSON.stringify(value))
    }
  }

  /** Raw stored value (`system` or IANA id), for settings UI. */
  getTimezoneSetting(): string {
    return this.get<string>('timezone') ?? SYSTEM_TIMEZONE
  }

  /** Resolved IANA timezone used by smart lists / calendar. */
  getTimezone(): string {
    return resolveTimezone(this.getTimezoneSetting())
  }

  getWeekStartsOn(): 0 | 1 {
    const value = this.get<number | string>('week_starts_on')
    if (value === 0 || value === '0') return 0
    return 1
  }

  getAppearance(): AppearanceSettings {
    return readAppearanceSettings(this.db)
  }

  setAppearance(partial: Partial<AppearanceSettings>): AppearanceSettings {
    if (partial.fontFamily !== undefined) this.set(APPEARANCE_KEYS.fontFamily, partial.fontFamily)
    if (partial.fontSize !== undefined) this.set(APPEARANCE_KEYS.fontSize, partial.fontSize)
    if (partial.themeMode !== undefined) this.set(APPEARANCE_KEYS.themeMode, partial.themeMode)
    if (partial.themeSource !== undefined) this.set(APPEARANCE_KEYS.themeSource, partial.themeSource)
    if (partial.presetId !== undefined) this.set(APPEARANCE_KEYS.presetId, partial.presetId)
    if (partial.customColors !== undefined) this.set(APPEARANCE_KEYS.customColors, partial.customColors)
    if (partial.imageThemePath !== undefined) {
      this.set(APPEARANCE_KEYS.imageThemePath, partial.imageThemePath)
    }
    if (partial.extractedPalette !== undefined) {
      this.set(APPEARANCE_KEYS.extractedPalette, partial.extractedPalette)
    }
    return this.getAppearance()
  }
}
