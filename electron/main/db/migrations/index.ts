import type Database from 'better-sqlite3'
import { migration001 } from './001_initial'
import { migration002 } from './002_project_folders'
import { migration003 } from './003_appearance'
import { migration004 } from './004_rich_tasks'
import { migration005 } from './005_sticky_notes'
import { migration006 } from './006_system_timezone'
import { migration007 } from './007_desktop_fts'
import { migration008 } from './008_project_sections'
import { migration009 } from './009_drop_project_sections'
import { migration010 } from './010_fix_tasks_section_fk'
import { migration011 } from './011_normalize_task_dates'
import { migration012 } from './012_tasks_parent_counts_index'

export interface Migration {
  version: number
  up: (db: Database.Database) => void
}

export const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  const row = db.prepare('SELECT MAX(version) as v FROM schema_migrations').get() as
    | { v: number | null }
    | undefined
  const current = row?.v ?? 0

  for (const migration of migrations.filter((item) => item.version > current)) {
    const apply = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version)
    })
    apply()
  }
}
