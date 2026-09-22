import type Database from 'better-sqlite3'
import { DESKTOP_DEFAULTS, DESKTOP_SETTING_KEYS } from '@shared/desktopSettings'

/**
 * Phase 12: FTS5 search, reminder notify tracking, desktop setting defaults.
 */
export const migration007 = {
  version: 7,
  up(db: Database.Database): void {
    const reminderCols = (
      db.prepare(`PRAGMA table_info(task_reminders)`).all() as { name: string }[]
    ).map((c) => c.name)
    if (!reminderCols.includes('last_notified_at')) {
      db.exec(`ALTER TABLE task_reminders ADD COLUMN last_notified_at TEXT`)
    }

    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        title,
        content,
        content='tasks',
        content_rowid='rowid'
      );

      INSERT INTO tasks_fts(tasks_fts) VALUES('rebuild');

      CREATE TRIGGER IF NOT EXISTS tasks_fts_ai AFTER INSERT ON tasks BEGIN
        INSERT INTO tasks_fts(rowid, title, content)
          VALUES (new.rowid, new.title, IFNULL(new.content, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_fts_ad AFTER DELETE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, content)
          VALUES ('delete', old.rowid, old.title, IFNULL(old.content, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS tasks_fts_au AFTER UPDATE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, content)
          VALUES ('delete', old.rowid, old.title, IFNULL(old.content, ''));
        INSERT INTO tasks_fts(rowid, title, content)
          VALUES (new.rowid, new.title, IFNULL(new.content, ''));
      END;
    `)

    const seed = db.prepare(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    )
    seed.run(DESKTOP_SETTING_KEYS.autoStart, JSON.stringify(DESKTOP_DEFAULTS.autoStart))
    seed.run(
      DESKTOP_SETTING_KEYS.shortcutQuickCapture,
      JSON.stringify(DESKTOP_DEFAULTS.shortcutQuickCapture),
    )
    seed.run(
      DESKTOP_SETTING_KEYS.shortcutNewSticky,
      JSON.stringify(DESKTOP_DEFAULTS.shortcutNewSticky),
    )
    seed.run(
      DESKTOP_SETTING_KEYS.stickyPinByDefault,
      JSON.stringify(DESKTOP_DEFAULTS.stickyPinByDefault),
    )
  },
}
