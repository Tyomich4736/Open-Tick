import type Database from 'better-sqlite3'

export const migration005 = {
  version: 5,
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sticky_notes (
        id            TEXT PRIMARY KEY,
        task_id       TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
        window_x      REAL NOT NULL,
        window_y      REAL NOT NULL,
        width         REAL NOT NULL,
        height        REAL NOT NULL,
        is_pinned     INTEGER NOT NULL DEFAULT 1,
        is_collapsed  INTEGER NOT NULL DEFAULT 0,
        color         TEXT,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sticky_notes_task ON sticky_notes(task_id);
    `)
  },
}
