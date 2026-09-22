import type Database from 'better-sqlite3'

export const migration002 = {
  version: 2,
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_folders (
        id                  TEXT PRIMARY KEY,
        remote_id           TEXT UNIQUE,
        name                TEXT NOT NULL,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        sync_status         TEXT NOT NULL DEFAULT 'synced',
        remote_updated_at   TEXT,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted_at          TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_project_folders_remote_id ON project_folders(remote_id);
      CREATE INDEX IF NOT EXISTS idx_project_folders_deleted ON project_folders(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_project_folders_sort ON project_folders(sort_order);
    `)

    const columns = db.prepare('PRAGMA table_info(projects)').all() as { name: string }[]
    if (!columns.some((c) => c.name === 'folder_id')) {
      db.exec(`ALTER TABLE projects ADD COLUMN folder_id TEXT REFERENCES project_folders(id)`)
    }

    db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id)`)

    db.prepare(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('folder_expanded', '{}')`,
    ).run()
  },
}
