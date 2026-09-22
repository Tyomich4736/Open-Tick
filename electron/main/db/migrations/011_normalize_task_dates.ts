import type Database from 'better-sqlite3'
import { normalizeAllDayInstant, toUtcIso } from '@shared/taskDates'

/**
 * Rewrite task due/start timestamps to canonical UTC Z ISO strings.
 * All-day values become noon in the task timezone so smart-list day bounds
 * (also UTC Z) classify them on the correct calendar day.
 */
export const migration011 = {
  version: 11,
  up(db: Database.Database): void {
    const rows = db
      .prepare(
        `SELECT id, due_date, start_date, is_all_day, time_zone
         FROM tasks
         WHERE due_date IS NOT NULL OR start_date IS NOT NULL`,
      )
      .all() as {
      id: string
      due_date: string | null
      start_date: string | null
      is_all_day: number
      time_zone: string | null
    }[]

    const update = db.prepare(
      `UPDATE tasks SET due_date = ?, start_date = ? WHERE id = ?`,
    )

    for (const row of rows) {
      const allDay = row.is_all_day === 1
      const due = allDay
        ? normalizeAllDayInstant(row.due_date, row.time_zone)
        : toUtcIso(row.due_date)
      const start = allDay
        ? normalizeAllDayInstant(row.start_date, row.time_zone)
        : toUtcIso(row.start_date)

      if (due === row.due_date && start === row.start_date) continue
      update.run(due, start, row.id)
    }
  },
}
