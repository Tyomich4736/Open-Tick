import type Database from 'better-sqlite3'

/**
 * Migration 009 dropped `project_sections` but often left `tasks.section_id`
 * with a foreign key to that table (SQLite DROP COLUMN is unavailable or leaves
 * the FK). With foreign_keys=ON, every INSERT/UPDATE on tasks then fails:
 *   SqliteError: no such table: main.project_sections
 *
 * Rebuild tasks without section_id and recreate FTS triggers.
 */
export const migration010 = {
  version: 10,
  up(db: Database.Database): void {
    const taskCols = (
      db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[]
    ).map((c) => c.name)

    const fkRows = db.prepare(`PRAGMA foreign_key_list(tasks)`).all() as {
      table: string
      from: string
    }[]
    const hasBrokenSectionFk = fkRows.some((fk) => fk.table === 'project_sections')
    const hasSectionCol = taskCols.includes('section_id')

    if (!hasBrokenSectionFk && !hasSectionCol) {
      // Already clean (e.g. fresh DB that never had sections).
      return
    }

    db.pragma('foreign_keys = OFF')

    db.exec(`
      DROP TRIGGER IF EXISTS tasks_fts_ai;
      DROP TRIGGER IF EXISTS tasks_fts_ad;
      DROP TRIGGER IF EXISTS tasks_fts_au;
      DROP TABLE IF EXISTS tasks_fts;
    `)

    db.exec(`
      CREATE TABLE tasks_new (
        id                  TEXT PRIMARY KEY,
        remote_id           TEXT UNIQUE,
        project_id          TEXT NOT NULL REFERENCES projects(id),
        parent_id           TEXT REFERENCES tasks_new(id),
        title               TEXT NOT NULL,
        content             TEXT NOT NULL DEFAULT '',
        priority            INTEGER NOT NULL DEFAULT 0,
        status              TEXT NOT NULL DEFAULT 'pending',
        due_date            TEXT,
        start_date          TEXT,
        is_all_day          INTEGER NOT NULL DEFAULT 0,
        time_zone           TEXT,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        sync_status         TEXT NOT NULL DEFAULT 'synced',
        remote_updated_at   TEXT,
        completed_at        TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT,
        recurrence_rule     TEXT,
        recurrence_parent_id TEXT REFERENCES tasks_new(id)
      );

      INSERT INTO tasks_new (
        id, remote_id, project_id, parent_id, title, content, priority, status,
        due_date, start_date, is_all_day, time_zone, sort_order, sync_status,
        remote_updated_at, completed_at, created_at, updated_at, deleted_at,
        recurrence_rule, recurrence_parent_id
      )
      SELECT
        id, remote_id, project_id, parent_id, title, content, priority, status,
        due_date, start_date, is_all_day, time_zone, sort_order, sync_status,
        remote_updated_at, completed_at, created_at, updated_at, deleted_at,
        recurrence_rule, recurrence_parent_id
      FROM tasks;

      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;

      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_remote_id ON tasks(remote_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_sync ON tasks(sync_status);
      CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON tasks(recurrence_parent_id);
    `)

    // Recreate FTS5 (content-sync with tasks)
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

    // Ensure project_sections is gone if 009 partially applied
    db.exec(`DROP TABLE IF EXISTS project_sections`)

    db.pragma('foreign_keys = ON')
  },
}
