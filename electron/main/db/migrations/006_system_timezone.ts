import type Database from 'better-sqlite3'

/**
 * Prefer the OS timezone by default. Existing installs that still have the
 * Phase-1 seed value "UTC" are migrated to "system" so smart lists match the
 * user's clock unless they later pick a zone manually.
 */
export const migration006 = {
  version: 6,
  up(db: Database.Database): void {
    db.prepare(
      `UPDATE settings SET value = ? WHERE key = 'timezone' AND value = ?`,
    ).run(JSON.stringify('system'), JSON.stringify('UTC'))

    db.prepare(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    ).run('timezone', JSON.stringify('system'))
  },
}
