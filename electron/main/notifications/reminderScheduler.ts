import { Notification } from 'electron'
import { parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { DESKTOP_SETTING_KEYS, DESKTOP_DEFAULTS } from '@shared/desktopSettings'
import { isDateOnlySchedule } from '@shared/dueSchedule'
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
  /** End of range (or point-in-time when start is null). */
  due_date: string
  /** Start of timed duration; null for point-in-time / all-day-only due. */
  start_date: string | null
  is_all_day: number
  kind: ReminderKind
  offset_minutes: number
  last_notified_at: string | null
}

/** 09:00 on the calendar day of `dayIso` in `timeZone` (or local wall clock). */
export function nineAmOnCalendarDay(
  dayIso: string,
  timeZone?: string | null,
): string | null {
  try {
    const zone =
      timeZone && timeZone.trim() && timeZone !== 'system' ? timeZone.trim() : null
    if (zone) {
      const dateStr = formatInTimeZone(parseISO(dayIso), zone, 'yyyy-MM-dd')
      return fromZonedTime(`${dateStr}T09:00:00.000`, zone).toISOString()
    }
    const d = parseISO(dayIso)
    d.setHours(9, 0, 0, 0)
    return d.toISOString()
  } catch {
    return null
  }
}

function notificationsEnabled(): boolean {
  const value = getRepositories().settings.get<boolean>(
    DESKTOP_SETTING_KEYS.notificationsEnabled,
  )
  return value ?? DESKTOP_DEFAULTS.notificationsEnabled
}

export type ReminderAnchorOptions = {
  is_all_day?: boolean
  timeZone?: string | null
}

/**
 * Instant reminders are relative to: duration start when set, else due.
 * (13:00–13:30 + 5 min before → 12:55, not 13:25.)
 * Date-only / all-day (no clock) use 09:00 on that calendar day.
 */
export function reminderAnchorIso(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
  options?: ReminderAnchorOptions,
): string | null {
  if (!dueDate && !startDate) return null

  const fields = {
    due_date: dueDate ?? null,
    start_date: startDate ?? null,
    is_all_day: options?.is_all_day ?? false,
  }
  const noClock = fields.is_all_day || isDateOnlySchedule(fields)
  if (noClock) {
    const dayIso = startDate || dueDate
    return dayIso ? nineAmOnCalendarDay(dayIso, options?.timeZone) : null
  }

  return startDate || dueDate || null
}

/** When the reminder should fire, based on anchor instant + kind/offset. */
export function reminderFireAtMs(
  anchorIso: string,
  kind: ReminderKind,
  offsetMinutes: number,
): number {
  const anchor = new Date(anchorIso).getTime()
  if (!Number.isFinite(anchor)) return Number.NaN
  if (kind === 'after') return anchor + offsetMinutes * 60_000
  // before + at_due (offset 0)
  return anchor - offsetMinutes * 60_000
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

function notificationBody(anchorMs: number, row: DueReminderRow, now: number, fireAt: number): string {
  const when = new Date(anchorMs).toLocaleString()
  if (row.kind === 'at_due' || row.offset_minutes === 0) {
    return now >= anchorMs ? 'Due now' : 'Due soon'
  }
  if (row.kind === 'after') {
    return `Due ${when}`
  }
  // before — if already past the anchor, don't claim "Due in X"
  if (now >= anchorMs) {
    return `Was due ${when}`
  }
  if (fireAt <= now && row.offset_minutes < 60) {
    const minsLeft = Math.max(0, Math.round((anchorMs - now) / 60_000))
    return minsLeft <= 0 ? 'Due now' : `Due in ${minsLeft} min`
  }
  if (row.offset_minutes < 60) return `Due in ${row.offset_minutes} min`
  if (row.offset_minutes < 1440) return `Due in ${Math.round(row.offset_minutes / 60)} h`
  return `Reminder · due ${when}`
}

function pollReminders(): void {
  if (!notificationsEnabled()) return

  const repos = getRepositories()
  const now = Date.now()
  const timeZone = repos.settings.getTimezone()

  const rows = repos.db
    .prepare(
      `SELECT
         r.id AS reminder_id,
         r.task_id,
         t.title,
         t.due_date,
         t.start_date,
         t.is_all_day,
         r.kind,
         r.offset_minutes,
         r.last_notified_at
       FROM task_reminders r
       INNER JOIN tasks t ON t.id = r.task_id
       WHERE t.deleted_at IS NULL
         AND t.status = 'pending'
         AND COALESCE(t.start_date, t.due_date) IS NOT NULL
         AND r.last_notified_at IS NULL`,
    )
    .all() as DueReminderRow[]

  const mark = repos.db.prepare(
    `UPDATE task_reminders SET last_notified_at = ? WHERE id = ?`,
  )

  for (const row of rows) {
    const anchor = reminderAnchorIso(row.start_date, row.due_date, {
      is_all_day: Boolean(row.is_all_day),
      timeZone,
    })
    if (!anchor) continue
    const fireAt = reminderFireAtMs(anchor, row.kind, row.offset_minutes)
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

    const anchorMs = new Date(anchor).getTime()
    const notification = new Notification({
      title: row.title || 'Task reminder',
      body: notificationBody(anchorMs, row, now, fireAt),
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
