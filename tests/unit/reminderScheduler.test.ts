import { describe, expect, it } from 'vitest'
import {
  reminderFireAtMs,
  shouldShowReminder,
  REMINDER_NOTIFY_GRACE_MS,
} from '../../electron/main/notifications/reminderScheduler'

describe('reminderFireAtMs', () => {
  it('fires at due for at_due', () => {
    const due = '2026-10-21T12:00:00.000Z'
    expect(reminderFireAtMs(due, 'at_due', 0)).toBe(Date.parse(due))
  })

  it('fires offset before due', () => {
    const due = '2026-10-21T12:00:00.000Z'
    expect(reminderFireAtMs(due, 'before', 15)).toBe(Date.parse(due) - 15 * 60_000)
  })

  it('fires offset after due', () => {
    const due = '2026-10-21T12:00:00.000Z'
    expect(reminderFireAtMs(due, 'after', 30)).toBe(Date.parse(due) + 30 * 60_000)
  })
})

describe('shouldShowReminder', () => {
  const now = Date.parse('2026-10-21T18:00:00.000Z')

  it('does not show future reminders', () => {
    expect(shouldShowReminder(now + 60_000, now)).toBe(false)
  })

  it('shows reminders that just became due', () => {
    expect(shouldShowReminder(now - 10_000, now)).toBe(true)
    expect(shouldShowReminder(now, now)).toBe(true)
  })

  it('silences stale reminders outside the grace window', () => {
    expect(shouldShowReminder(now - REMINDER_NOTIFY_GRACE_MS - 1, now)).toBe(false)
    expect(shouldShowReminder(now - 24 * 60 * 60_000, now)).toBe(false)
  })

  it('still shows at the edge of the grace window', () => {
    expect(shouldShowReminder(now - REMINDER_NOTIFY_GRACE_MS, now)).toBe(true)
  })
})
