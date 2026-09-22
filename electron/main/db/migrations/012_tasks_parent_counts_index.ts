import type Database from 'better-sqlite3'

/** Composite index for subtask count joins and parent lookups. */
export const migration012 = {
  version: 12,
  up(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_parent_deleted_status
        ON tasks(parent_id, deleted_at, status);
    `)
  },
}
