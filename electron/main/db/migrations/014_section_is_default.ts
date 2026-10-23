import type Database from 'better-sqlite3'
import { isDefaultSectionName } from '@shared/sections'

/** Mark TickTick's "Not Sectioned" column as the undeletable default per list. */
export const migration014 = {
  version: 14,
  up(db: Database.Database): void {
    const cols = (
      db.prepare(`PRAGMA table_info(project_sections)`).all() as { name: string }[]
    ).map((c) => c.name)
    if (!cols.includes('is_default')) {
      db.exec(
        `ALTER TABLE project_sections ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0`,
      )
    }

    const rows = db
      .prepare(
        `SELECT id, project_id, name, sort_order FROM project_sections WHERE deleted_at IS NULL`,
      )
      .all() as Array<{ id: string; project_id: string; name: string; sort_order: number }>

    const byProject = new Map<string, typeof rows>()
    for (const row of rows) {
      const list = byProject.get(row.project_id) ?? []
      list.push(row)
      byProject.set(row.project_id, list)
    }

    const setDefault = db.prepare(
      `UPDATE project_sections SET is_default = 1 WHERE id = ?`,
    )
    const clearDefaults = db.prepare(
      `UPDATE project_sections SET is_default = 0 WHERE project_id = ?`,
    )

    const assignNull = db.prepare(
      `UPDATE tasks SET section_id = ?
       WHERE project_id = ? AND section_id IS NULL AND deleted_at IS NULL`,
    )

    for (const [projectId, list] of byProject) {
      const named = list
        .filter((r) => isDefaultSectionName(r.name))
        .sort((a, b) => a.sort_order - b.sort_order)
      if (named[0]) {
        clearDefaults.run(projectId)
        setDefault.run(named[0].id)
        assignNull.run(named[0].id, projectId)
      }
    }
  },
}
