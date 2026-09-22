import type Database from 'better-sqlite3'

/**
 * Project sections (TickTick Kanban columns).
 * Tasks optionally belong to a section via section_id ↔ remote columnId.
 */
export const migration008 = {
  version: 8,
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_sections (
        id                  TEXT PRIMARY KEY,
        remote_id           TEXT UNIQUE,
        project_id          TEXT NOT NULL REFERENCES projects(id),
        name                TEXT NOT NULL,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        sync_status         TEXT NOT NULL DEFAULT 'synced',
        remote_updated_at   TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_project_sections_project
        ON project_sections(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_sections_remote_id
        ON project_sections(remote_id);
      CREATE INDEX IF NOT EXISTS idx_project_sections_deleted
        ON project_sections(deleted_at);
    `)

    const taskCols = (
      db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[]
    ).map((c) => c.name)
    if (!taskCols.includes('section_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN section_id TEXT REFERENCES project_sections(id)`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id)`)
    }
  },
}
