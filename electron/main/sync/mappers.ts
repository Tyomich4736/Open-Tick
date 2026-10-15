import type { Priority, ProjectViewMode } from '@shared/entities'
import { preserveMarkdownBlankLines, toTickTickContent } from '@shared/markdownBlankLines'
import type { RecurrenceRule, ReminderInput } from '@shared/recurrence'
import { normalizeAllDayInstant, toUtcIso } from '@shared/taskDates'
import type { RemoteProject, RemoteProjectGroup, RemoteTask } from '../ticktick/remoteTypes'

export function mapRemotePriority(value: number | undefined): Priority {
  if (value === 1 || value === 3 || value === 5) return value
  return 0
}

export function mapRemoteStatus(value: number | undefined): 'pending' | 'completed' {
  return value === 2 ? 'completed' : 'pending'
}

export function mapRemoteViewMode(value: string | undefined): ProjectViewMode {
  if (value === 'kanban' || value === 'timeline') return value
  return 'list'
}

/** Parse TickTick TRIGGER reminder strings → local ReminderInput[] */
export function mapRemoteReminders(reminders: string[] | null | undefined): ReminderInput[] {
  if (!reminders?.length) return []
  const out: ReminderInput[] = []
  for (const raw of reminders) {
    const mapped = parseTrigger(raw)
    if (mapped) out.push(mapped)
    if (out.length >= 5) break
  }
  return out
}

function parseTrigger(raw: string): ReminderInput | null {
  const s = raw.trim().toUpperCase()
  const trigger = s.startsWith('TRIGGER:') ? s.slice('TRIGGER:'.length) : s
  if (!trigger || trigger === 'PT0S' || trigger === 'P0D' || trigger === 'PT0M') {
    return { kind: 'at_due', offset_minutes: 0 }
  }

  const negative = trigger.startsWith('-')
  const body = negative ? trigger.slice(1) : trigger
  const minutes = parseIsoDurationToMinutes(body)
  if (minutes == null) return null
  if (minutes === 0) return { kind: 'at_due', offset_minutes: 0 }
  return {
    kind: negative ? 'before' : 'after',
    offset_minutes: minutes,
  }
}

/** Minimal ISO-8601 duration → minutes (P#D T#H #M #S). */
export function parseIsoDurationToMinutes(iso: string): number | null {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(iso)
  if (!match) return null
  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const mins = Number(match[3] ?? 0)
  const secs = Number(match[4] ?? 0)
  return days * 1440 + hours * 60 + mins + Math.round(secs / 60)
}

/** Parse TickTick repeatFlag / RRULE into local RecurrenceRule */
export function mapRemoteRecurrence(repeatFlag: string | null | undefined): RecurrenceRule | null {
  if (!repeatFlag?.trim()) return null
  let rule = repeatFlag.trim()
  if (rule.toUpperCase().startsWith('RRULE:')) rule = rule.slice(6)

  const parts = Object.fromEntries(
    rule.split(';').map((p) => {
      const [k, v] = p.split('=')
      return [k.toUpperCase(), v]
    }),
  )

  const freqRaw = (parts.FREQ ?? '').toUpperCase()
  let frequency: RecurrenceRule['frequency'] | null = null
  if (freqRaw === 'DAILY') frequency = 'daily'
  else if (freqRaw === 'WEEKLY') frequency = 'weekly'
  else if (freqRaw === 'MONTHLY') frequency = 'monthly'
  else if (freqRaw === 'YEARLY') frequency = 'yearly'
  if (!frequency) return null

  const interval = Math.max(1, Number(parts.INTERVAL ?? 1) || 1)
  const weekdays = parseByDay(parts.BYDAY)

  let end: RecurrenceRule['end'] = { type: 'never' }
  if (parts.COUNT) {
    const count = Number(parts.COUNT)
    if (Number.isFinite(count) && count > 0) end = { type: 'after_count', count }
  } else if (parts.UNTIL) {
    const date = parseUntil(parts.UNTIL)
    if (date) end = { type: 'on_date', date }
  }

  return {
    frequency,
    interval,
    weekdays: frequency === 'weekly' ? weekdays : undefined,
    anchor: 'due_date',
    end,
    completed_count: 0,
  }
}

function parseByDay(byDay: string | undefined): number[] | undefined {
  if (!byDay) return undefined
  const map: Record<string, number> = {
    SU: 0,
    MO: 1,
    TU: 2,
    WE: 3,
    TH: 4,
    FR: 5,
    SA: 6,
  }
  const days = byDay
    .split(',')
    .map((d) => map[d.replace(/^-?\d+/, '').toUpperCase()])
    .filter((n): n is number => n !== undefined)
  return days.length ? days : undefined
}

function parseUntil(until: string): string | null {
  // YYYYMMDD or YYYYMMDDTHHMMSSZ
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(until)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`
}

export interface MappedFolder {
  remote_id: string
  name: string
  sort_order: number
  remote_updated_at: string | null
}

export function remoteFolderToLocal(remote: RemoteProjectGroup): MappedFolder {
  return {
    remote_id: remote.id,
    name: remote.name?.trim() || 'Untitled folder',
    sort_order: remote.sortOrder ?? 0,
    remote_updated_at: null,
  }
}

export interface MappedProject {
  remote_id: string
  name: string
  color: string
  view_mode: ProjectViewMode
  kind: string
  group_remote_id: string | null
  sort_order: number
  remote_updated_at: string | null
}

export function remoteProjectToLocal(remote: RemoteProject): MappedProject {
  return {
    remote_id: remote.id,
    name: remote.name?.trim() || 'Untitled',
    color: remote.color?.startsWith('#') ? remote.color : '#4772FA',
    view_mode: mapRemoteViewMode(remote.viewMode),
    kind: remote.kind ?? 'TASK',
    group_remote_id: remote.groupId ?? null,
    sort_order: remote.sortOrder ?? 0,
    remote_updated_at: remote.modifiedTime ?? null,
  }
}

export interface MappedTask {
  remote_id: string
  project_remote_id: string
  parent_remote_id: string | null
  title: string
  content: string
  priority: Priority
  status: 'pending' | 'completed'
  due_date: string | null
  start_date: string | null
  is_all_day: boolean
  time_zone: string | null
  tags: string[]
  reminders: ReminderInput[]
  recurrence_rule: RecurrenceRule | null
  sort_order: number
  remote_updated_at: string | null
  completed_at: string | null
}

export function remoteTaskToLocal(remote: RemoteTask): MappedTask {
  const isAllDay = Boolean(remote.isAllDay)
  const { due_date, start_date } = normalizeRemoteSchedule(
    remote.dueDate,
    remote.startDate,
    isAllDay,
    remote.timeZone,
  )

  return {
    remote_id: remote.id,
    project_remote_id: remote.projectId,
    parent_remote_id: remote.parentId ?? null,
    title: (remote.title ?? '').trim() || 'Untitled',
    content: preserveMarkdownBlankLines(remote.content ?? remote.desc ?? ''),
    priority: mapRemotePriority(remote.priority),
    status: mapRemoteStatus(remote.status),
    due_date,
    start_date,
    is_all_day: isAllDay,
    time_zone: remote.timeZone ?? null,
    tags: Array.isArray(remote.tags) ? remote.tags.filter(Boolean) : [],
    reminders: mapRemoteReminders(remote.reminders),
    recurrence_rule: mapRemoteRecurrence(remote.repeatFlag),
    sort_order: typeof remote.sortOrder === 'number' ? remote.sortOrder : 0,
    remote_updated_at: remote.modifiedTime ?? null,
    completed_at: remote.completedTime ?? null,
  }
}

/**
 * TickTick often sets startDate === dueDate for a single timed point (no duration),
 * or only startDate. Store those as due-only so the UI does not show "15:00–15:00".
 *
 * All-day instants are rewritten to noon in the task timezone (canonical UTC Z)
 * so smart lists compare calendar days correctly.
 */
export function normalizeRemoteSchedule(
  dueDate: string | null | undefined,
  startDate: string | null | undefined,
  isAllDay = false,
  timeZone?: string | null,
): { due_date: string | null; start_date: string | null } {
  let due = dueDate ?? null
  let start = startDate ?? null

  if (!start && !due) return { due_date: null, start_date: null }
  if (!start) {
    due = isAllDay ? normalizeAllDayInstant(due, timeZone) : toUtcIso(due)
    return { due_date: due, start_date: null }
  }
  if (!due) {
    const only = isAllDay ? normalizeAllDayInstant(start, timeZone) : toUtcIso(start)
    return { due_date: only, start_date: null }
  }

  try {
    const startMs = Date.parse(start)
    const dueMs = Date.parse(due)
    if (Number.isFinite(startMs) && Number.isFinite(dueMs) && Math.abs(startMs - dueMs) < 60_000) {
      const point = isAllDay ? normalizeAllDayInstant(due, timeZone) : toUtcIso(due)
      return { due_date: point, start_date: null }
    }
  } catch {
    /* fall through */
  }

  if (isAllDay) {
    return {
      due_date: normalizeAllDayInstant(due, timeZone),
      start_date: normalizeAllDayInstant(start, timeZone),
    }
  }

  return { due_date: toUtcIso(due), start_date: toUtcIso(start) }
}

// ─── Outbound (local → TickTick) ─────────────────────────────────────────────

export function reminderToTrigger(reminder: ReminderInput): string {
  if (reminder.kind === 'at_due' || reminder.offset_minutes === 0) {
    return 'TRIGGER:PT0S'
  }
  const duration = minutesToIsoDuration(reminder.offset_minutes)
  const prefix = reminder.kind === 'before' ? '-' : ''
  return `TRIGGER:${prefix}${duration}`
}

export function minutesToIsoDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  if (minutes === 0) return 'PT0S'
  if (minutes % 1440 === 0) return `P${minutes / 1440}D`
  if (minutes % 60 === 0) return `PT${minutes / 60}H`
  return `PT${minutes}M`
}

export function recurrenceToRepeatFlag(rule: RecurrenceRule): string {
  const freq = rule.frequency.toUpperCase()
  const parts = [`FREQ=${freq}`, `INTERVAL=${Math.max(1, rule.interval || 1)}`]
  if (rule.frequency === 'weekly' && rule.weekdays?.length) {
    const map = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
    const days = rule.weekdays.map((d) => map[d]).filter(Boolean)
    if (days.length) parts.push(`BYDAY=${days.join(',')}`)
  }
  if (rule.end.type === 'after_count') {
    parts.push(`COUNT=${rule.end.count}`)
  } else if (rule.end.type === 'on_date') {
    const d = rule.end.date.replace(/[-:]/g, '').slice(0, 8)
    if (/^\d{8}$/.test(d)) parts.push(`UNTIL=${d}`)
  }
  return `RRULE:${parts.join(';')}`
}

export function localFolderToRemote(folder: {
  name: string
  sort_order: number
}): Record<string, unknown> {
  return {
    name: folder.name,
    sortOrder: folder.sort_order,
  }
}

export function localProjectToRemote(project: {
  name: string
  color: string
  view_mode: ProjectViewMode
  kind: string
  sort_order: number
  groupRemoteId: string | null
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: project.name,
    color: project.color,
    viewMode: project.view_mode,
    kind: project.kind || 'TASK',
    sortOrder: project.sort_order,
  }
  if (project.groupRemoteId) payload.groupId = project.groupRemoteId
  return payload
}

export function localTaskToRemote(input: {
  title: string
  content: string
  projectRemoteId: string
  parentRemoteId?: string | null
  priority: Priority
  status: 'pending' | 'completed'
  due_date: string | null
  start_date: string | null
  is_all_day: boolean
  time_zone: string | null
  tags: string[]
  reminders: ReminderInput[]
  recurrence_rule: RecurrenceRule | null
  sort_order: number
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: input.title,
    projectId: input.projectRemoteId,
    content: toTickTickContent(input.content || ''),
    priority: input.priority,
    status: input.status === 'completed' ? 2 : 0,
    isAllDay: input.is_all_day,
    sortOrder: input.sort_order,
    kind: 'TEXT',
  }
  if (input.parentRemoteId) payload.parentId = input.parentRemoteId
  if (input.due_date) payload.dueDate = input.due_date
  if (input.start_date) payload.startDate = input.start_date
  if (input.time_zone) payload.timeZone = input.time_zone
  if (input.tags.length) payload.tags = input.tags
  // Always send reminders (including []) so clearing them syncs to TickTick
  payload.reminders = input.reminders.map(reminderToTrigger)
  if (input.recurrence_rule) {
    payload.repeatFlag = recurrenceToRepeatFlag(input.recurrence_rule)
  }
  return payload
}

/** Pull `id` from TickTick create/update JSON responses. */
export function extractRemoteId(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null
  const id = (response as { id?: unknown }).id
  return typeof id === 'string' && id.length > 0 ? id : null
}
