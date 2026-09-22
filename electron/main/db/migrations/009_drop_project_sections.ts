import type Database from 'better-sqlite3'

/**
 * Remove project sections (TickTick columns) — feature reverted.
 *
 * Note: simply DROP COLUMN / DROP TABLE leaves a dangling FK on some SQLite
 * builds. Migration 010 rebuilds `tasks` to fully clear section_id + FK.
 * Here we only null out references and drop the sections table.
 */
export const migration009 = {
  version: 9,
  up(db: Database.Database): void {
    db.pragma('foreign_keys = OFF')

    const taskCols = (
      db.prepare(`PRAGMA table_info(tasks)`).all() as { name: string }[]
    ).map((c) => c.name)

    if (taskCols.includes('section_id')) {
      db.exec(`UPDATE tasks SET section_id = NULL WHERE section_id IS NOT NULL`)
      try {
        db.exec(`ALTER TABLE tasks DROP COLUMN section_id`)
      } catch {
        // DROP COLUMN may be unsupported or leave FK metadata — fixed in 010.
      }
    }

    db.exec(`DROP TABLE IF EXISTS project_sections`)
    db.pragma('foreign_keys = ON')
  },
}
