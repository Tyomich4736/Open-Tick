import { describe, expect, it } from 'vitest'
import {
  reminderAnchorIso,
  reminderFireAtMs,
  shouldShowReminder,
  REMINDER_NOTIFY_GRACE_MS,
} from '../../electron/main/notifications/reminderScheduler'

describe('reminderAnchorIso', () => {
  it('prefers start over due for timed durations', () => {
    expect(
      reminderAnchorIso('2026-10-21T13:00:00.000Z', '2026-10-21T13:30:00.000Z'),
    ).toBe('2026-10-21T13:00:00.000Z')
  })

  it('falls back to due when start is missing', () => {
    expect(reminderAnchorIso(null, '2026-10-21T13:30:00.000Z')).toBe(
      '2026-10-21T13:30:00.000Z',
    )
  })
})

describe('reminderFireAtMs', () => {
  it('fires at anchor for at_due', () => {
    const due = '2026-10-21T12:00:00.000Z'
    expect(reminderFireAtMs(due, 'at_due', 0)).toBe(Date.parse(due))
  })

  it('fires offset before anchor', () => {
    const due = '2026-10-21T12:00:00.000Z'
    expect(reminderFireAtMs(due, 'before', 15)).toBe(Date.parse(due) - 15 * 60_000)
  })

  it('fires offset after anchor', () => {
    const due = '2026-10-21T12:00:00.000Z'
    expect(reminderFireAtMs(due, 'after', 30)).toBe(Date.parse(due) + 30 * 60_000)
  })

  it('duration 13:00–13:30: on-time and 5-min-before use start, not end', () => {
    const start = '2026-10-21T13:00:00.000Z'
    const end = '2026-10-21T13:30:00.000Z'
    const anchor = reminderAnchorIso(start, end)!
    expect(reminderFireAtMs(anchor, 'at_due', 0)).toBe(Date.parse(start))
    expect(reminderFireAtMs(anchor, 'before', 5)).toBe(Date.parse(start) - 5 * 60_000)
    // Regression: must not be relative to end (13:25 / 13:30)
    expect(reminderFireAtMs(anchor, 'before', 5)).not.toBe(Date.parse(end) - 5 * 60_000)
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
