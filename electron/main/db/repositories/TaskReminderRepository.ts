import type Database from 'better-sqlite3'
import type { ReminderInput, TaskReminder } from '@shared/recurrence'
import { MAX_REMINDERS } from '@shared/recurrence'
import { newId, nowIso } from '../utils'

interface ReminderRow {
  id: string
  task_id: string
  kind: TaskReminder['kind']
  offset_minutes: number
  created_at: string
  last_notified_at?: string | null
}

function mapReminder(row: ReminderRow): TaskReminder {
  return {
    id: row.id,
    task_id: row.task_id,
    kind: row.kind,
    offset_minutes: row.offset_minutes,
    created_at: row.created_at,
  }
}

function reminderKey(kind: string, offsetMinutes: number): string {
  return `${kind}:${offsetMinutes}`
}

export class TaskReminderRepository {
  constructor(private db: Database.Database) {}

  listForTask(taskId: string): TaskReminder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM task_reminders WHERE task_id = ? ORDER BY
         CASE kind WHEN 'before' THEN 0 WHEN 'at_due' THEN 1 ELSE 2 END,
         offset_minutes ASC`,
      )
      .all(taskId) as ReminderRow[]
    return rows.map(mapReminder)
  }

  /**
   * Replace all reminders for a task.
   * When `preserveNotified` is true (inbound sync), keep `last_notified_at` for
   * matching kind+offset so a pull does not re-fire desktop notifications.
   */
  replaceForTask(
    taskId: string,
    reminders: ReminderInput[],
    options?: { preserveNotified?: boolean },
  ): TaskReminder[] {
    if (reminders.length > MAX_REMINDERS) {
      throw new Error(`A task can have at most ${MAX_REMINDERS} reminders`)
    }

    const apply = this.db.transaction(() => {
      const previousNotified = new Map<string, string>()
      if (options?.preserveNotified) {
        const prev = this.db
          .prepare(
            `SELECT kind, offset_minutes, last_notified_at FROM task_reminders WHERE task_id = ?`,
          )
          .all(taskId) as Array<{
          kind: string
          offset_minutes: number
          last_notified_at: string | null
        }>
        for (const row of prev) {
          if (row.last_notified_at) {
            previousNotified.set(
              reminderKey(row.kind, row.offset_minutes),
              row.last_notified_at,
            )
          }
        }
      }

      this.db.prepare('DELETE FROM task_reminders WHERE task_id = ?').run(taskId)
      const insert = this.db.prepare(
        `INSERT INTO task_reminders (id, task_id, kind, offset_minutes, created_at, last_notified_at)
         VALUES (@id, @task_id, @kind, @offset_minutes, @created_at, @last_notified_at)`,
      )
      const now = nowIso()
      const created: TaskReminder[] = []
      for (const item of reminders) {
        const row = {
          id: newId(),
          task_id: taskId,
          kind: item.kind,
          offset_minutes: item.offset_minutes,
          created_at: now,
          last_notified_at:
            previousNotified.get(reminderKey(item.kind, item.offset_minutes)) ?? null,
        }
        insert.run(row)
        created.push({
          id: row.id,
          task_id: row.task_id,
          kind: row.kind,
          offset_minutes: row.offset_minutes,
          created_at: row.created_at,
        })
      }
      return created
    })

    return apply()
  }

  /** Allow reminders to fire again after the due date / schedule changes. */
  clearNotifiedForTask(taskId: string): void {
    this.db
      .prepare(`UPDATE task_reminders SET last_notified_at = NULL WHERE task_id = ?`)
      .run(taskId)
  }

  copyToTask(fromTaskId: string, toTaskId: string): void {
    const source = this.listForTask(fromTaskId)
    this.replaceForTask(
      toTaskId,
      source.map((r) => ({ kind: r.kind, offset_minutes: r.offset_minutes })),
    )
  }
}
