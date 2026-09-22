/** RRULE-like recurrence stored as JSON on tasks.recurrence_rule */

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type RecurrenceAnchor = 'due_date' | 'completion'

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  /** Every N periods (default 1) */
  interval: number
  /** 0=Sun … 6=Sat; used when frequency is weekly */
  weekdays?: number[]
  anchor: RecurrenceAnchor
  end:
    | { type: 'never' }
    | { type: 'on_date'; date: string }
    | { type: 'after_count'; count: number }
  /** How many times the series has already produced instances (for after_count) */
  completed_count?: number
}

export type ReminderKind = 'before' | 'at_due' | 'after'

export interface TaskReminder {
  id: string
  task_id: string
  kind: ReminderKind
  /** Minutes relative to due (before/after) or 0 for at_due */
  offset_minutes: number
  created_at: string
}

export interface ReminderInput {
  kind: ReminderKind
  offset_minutes: number
}

export const REMINDER_PRESETS: { label: string; kind: ReminderKind; offset_minutes: number }[] = [
  { label: 'At due time', kind: 'at_due', offset_minutes: 0 },
  { label: '5 minutes before', kind: 'before', offset_minutes: 5 },
  { label: '15 minutes before', kind: 'before', offset_minutes: 15 },
  { label: '30 minutes before', kind: 'before', offset_minutes: 30 },
  { label: '1 hour before', kind: 'before', offset_minutes: 60 },
  { label: '1 day before', kind: 'before', offset_minutes: 1440 },
]

export function defaultRecurrence(frequency: RecurrenceFrequency): RecurrenceRule {
  return {
    frequency,
    interval: 1,
    weekdays: frequency === 'weekly' ? [new Date().getDay()] : undefined,
    anchor: 'due_date',
    end: { type: 'never' },
    completed_count: 0,
  }
}

export function recurrenceLabel(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return 'Does not repeat'
  const n = rule.interval > 1 ? ` ${rule.interval}` : ''
  switch (rule.frequency) {
    case 'daily':
      return rule.interval > 1 ? `Every ${rule.interval} days` : 'Every day'
    case 'weekly': {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const names = (rule.weekdays ?? []).map((d) => days[d]).join(', ')
      return names ? `Weekly (${names})` : `Every${n} week${rule.interval > 1 ? 's' : ''}`
    }
    case 'monthly':
      return rule.interval > 1 ? `Every ${rule.interval} months` : 'Every month'
    case 'yearly':
      return rule.interval > 1 ? `Every ${rule.interval} years` : 'Every year'
    default:
      return 'Custom'
  }
}

export function reminderLabel(reminder: Pick<TaskReminder, 'kind' | 'offset_minutes'>): string {
  if (reminder.kind === 'at_due' || reminder.offset_minutes === 0) return 'At due time'
  const m = reminder.offset_minutes
  const preset = REMINDER_PRESETS.find((p) => p.kind === reminder.kind && p.offset_minutes === m)
  if (preset) return preset.label
  if (m % 1440 === 0) {
    const days = m / 1440
    return `${days} day${days === 1 ? '' : 's'} ${reminder.kind === 'before' ? 'before' : 'after'}`
  }
  if (m % 60 === 0) {
    const hours = m / 60
    return `${hours} hour${hours === 1 ? '' : 's'} ${reminder.kind === 'before' ? 'before' : 'after'}`
  }
  return `${m} min ${reminder.kind === 'before' ? 'before' : 'after'}`
}

export const MAX_REMINDERS = 5
