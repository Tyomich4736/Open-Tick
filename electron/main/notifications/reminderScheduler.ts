import { Notification } from 'electron'
import { DESKTOP_SETTING_KEYS, DESKTOP_DEFAULTS } from '@shared/desktopSettings'
import type { ReminderKind } from '@shared/recurrence'
import { getRepositories } from '../db/connection'
import { getMainWindowRef, showMainWindow } from '../desktop/mainWindowRef'
import { IPC_CHANNELS } from '@shared/channels'

export const REMINDER_POLL_MS = 30_000
/**
 * Only show a desktop notification if the fire time is within this window of now.
 * Older due reminders (app was closed, first enable, etc.) are marked silently —
 * no catch-up spam on launch.
 */
export const REMINDER_NOTIFY_GRACE_MS = REMINDER_POLL_MS * 2

let timer: ReturnType<typeof setInterval> | null = null

interface DueReminderRow {
  reminder_id: string
  task_id: string
  title: string
  due_date: string
  kind: ReminderKind
  offset_minutes: number
  last_notified_at: string | null
}

function notificationsEnabled(): boolean {
  const value = getRepositories().settings.get<boolean>(
    DESKTOP_SETTING_KEYS.notificationsEnabled,
  )
  return value ?? DESKTOP_DEFAULTS.notificationsEnabled
}

/** When the reminder should fire, based on due instant + kind/offset. */
export function reminderFireAtMs(
  dueDate: string,
  kind: ReminderKind,
  offsetMinutes: number,
): number {
  const due = new Date(dueDate).getTime()
  if (!Number.isFinite(due)) return Number.NaN
  if (kind === 'after') return due + offsetMinutes * 60_000
  // before + at_due (offset 0)
  return due - offsetMinutes * 60_000
}

/** True only when fire time is due and still "now" (within grace). */
export function shouldShowReminder(
  fireAt: number,
  now: number,
  graceMs: number = REMINDER_NOTIFY_GRACE_MS,
): boolean {
  if (!Number.isFinite(fireAt) || fireAt > now) return false
  return now - fireAt <= graceMs
}

function notificationBody(row: DueReminderRow, now: number, fireAt: number): string {
  if (row.kind === 'at_due' || row.offset_minutes === 0) {
    return now >= new Date(row.due_date).getTime() ? 'Due now' : 'Due soon'
  }
  if (row.kind === 'after') {
    return `Due ${new Date(row.due_date).toLocaleString()}`
  }
  // before — if already past due, don't claim "Due in X"
  if (now >= new Date(row.due_date).getTime()) {
    return `Was due ${new Date(row.due_date).toLocaleString()}`
  }
  if (fireAt <= now && row.offset_minutes < 60) {
    const minsLeft = Math.max(0, Math.round((new Date(row.due_date).getTime() - now) / 60_000))
    return minsLeft <= 0 ? 'Due now' : `Due in ${minsLeft} min`
  }
  if (row.offset_minutes < 60) return `Due in ${row.offset_minutes} min`
  if (row.offset_minutes < 1440) return `Due in ${Math.round(row.offset_minutes / 60)} h`
  return `Reminder · due ${new Date(row.due_date).toLocaleString()}`
}

function pollReminders(): void {
  if (!notificationsEnabled()) return

  const repos = getRepositories()
  const now = Date.now()

  const rows = repos.db
    .prepare(
      `SELECT
         r.id AS reminder_id,
         r.task_id,
         t.title,
         t.due_date,
         r.kind,
         r.offset_minutes,
         r.last_notified_at
       FROM task_reminders r
       INNER JOIN tasks t ON t.id = r.task_id
       WHERE t.deleted_at IS NULL
         AND t.status = 'pending'
         AND t.due_date IS NOT NULL
         AND r.last_notified_at IS NULL`,
    )
    .all() as DueReminderRow[]

  const mark = repos.db.prepare(
    `UPDATE task_reminders SET last_notified_at = ? WHERE id = ?`,
  )

  for (const row of rows) {
    const fireAt = reminderFireAtMs(row.due_date, row.kind, row.offset_minutes)
    if (!Number.isFinite(fireAt) || fireAt > now) continue

    // Missed while closed / stale — silence without notifying
    if (!shouldShowReminder(fireAt, now)) {
      mark.run(new Date().toISOString(), row.reminder_id)
      continue
    }

    if (!Notification.isSupported()) {
      // Don't mark as notified — retry when notifications become available
      continue
    }

    const notification = new Notification({
      title: row.title || 'Task reminder',
      body: notificationBody(row, now, fireAt),
      silent: false,
    })

    const taskId = row.task_id
    notification.on('click', () => {
      showMainWindow()
      const main = getMainWindowRef()
      if (main && !main.isDestroyed()) {
        main.webContents.send(IPC_CHANNELS.TASK_FOCUS, { taskId })
      }
    })

    notification.show()
    mark.run(new Date().toISOString(), row.reminder_id)
  }
}

export function startReminderScheduler(): void {
  stopReminderScheduler()
  pollReminders()
  timer = setInterval(pollReminders, REMINDER_POLL_MS)
}

export function stopReminderScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
