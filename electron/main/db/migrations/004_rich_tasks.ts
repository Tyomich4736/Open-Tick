import type Database from 'better-sqlite3'

export const migration004 = {
  version: 4,
  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_reminders (
        id               TEXT PRIMARY KEY,
        task_id          TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        kind             TEXT NOT NULL CHECK (kind IN ('before', 'at_due', 'after')),
        offset_minutes   INTEGER NOT NULL DEFAULT 0,
        created_at       TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_task_reminders_task ON task_reminders(task_id);
    `)

    const columns = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[]
    const names = new Set(columns.map((c) => c.name))

    if (!names.has('recurrence_rule')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT`)
    }
    if (!names.has('recurrence_parent_id')) {
      db.exec(
        `ALTER TABLE tasks ADD COLUMN recurrence_parent_id TEXT REFERENCES tasks(id)`,
      )
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent ON tasks(recurrence_parent_id);
    `)
  },
}
