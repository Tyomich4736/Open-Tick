import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, format, startOfDay } from 'date-fns'
import {
  formatDayPart,
  formatDueDate,
  formatDueRange,
  isDurationSchedule,
} from '../../src/lib/formatDueDate'

describe('formatDayPart / timed due labels', () => {
  beforeEach(() => {
    // Saturday 2026-10-31 local noon — next calendar week starts soon depending on locale
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses Today and Tomorrow', () => {
    expect(formatDayPart(startOfDay(new Date()))).toBe('Today')
    expect(formatDayPart(startOfDay(addDays(new Date(), 1)))).toBe('Tomorrow')
  })

  it('uses weekday for dates within the next week (even across calendar week boundary)', () => {
    // Sunday = +1 → Tomorrow; Monday = +2 should be weekday not month/day
    const monday = startOfDay(addDays(new Date(), 2))
    expect(formatDayPart(monday)).toBe(format(monday, 'EEE'))
    const friday = startOfDay(addDays(new Date(), 6))
    expect(formatDayPart(friday)).toBe(format(friday, 'EEE'))
  })

  it('uses day + month when later than next week', () => {
    const later = startOfDay(addDays(new Date(), 7))
    expect(formatDayPart(later)).toBe(format(later, 'MMM d'))
    const muchLater = startOfDay(addDays(new Date(), 20))
    expect(formatDayPart(muchLater)).toBe(format(muchLater, 'MMM d'))
  })

  it('timed due includes weekday or month with time', () => {
    // Local wall-clock ISO so parseISO keeps the intended day/time
    const mondayLabel = formatDueDate('2026-11-02T15:30:00', false, '24h')
    expect(mondayLabel).toBe('Mon, 15:30')

    const laterLabel = formatDueDate('2026-11-10T09:00:00', false, '24h')
    expect(laterLabel).toBe('Nov 10, 09:00')
  })
})

describe('isDurationSchedule / all-day vs date-only', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 31, 12, 0, 0)) // Sat Oct 31 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats same-day all-day with start as duration (All day)', () => {
    const noon = new Date(2026, 10, 2, 12, 0, 0).toISOString()
    expect(isDurationSchedule(noon, noon, true)).toBe(true)
  })

  it('treats date-only (no start) as not duration (No time)', () => {
    expect(isDurationSchedule(null, '2026-11-02T12:00:00.000Z', false)).toBe(false)
  })

  it('labels date-only No time as a day without a clock', () => {
    const midnight = new Date(2026, 10, 2, 0, 0, 0).toISOString()
    expect(
      formatDueRange({ due_date: midnight, start_date: null, is_all_day: false }, '24h'),
    ).toBe('Mon')
  })

  it('labels same-day all-day as a day without a clock', () => {
    const noon = new Date(2026, 10, 2, 12, 0, 0).toISOString()
    expect(
      formatDueRange({ due_date: noon, start_date: noon, is_all_day: true }, '24h'),
    ).toBe('Mon')
  })

  it('labels multi-day all-day as a day range', () => {
    const start = new Date(2026, 10, 2, 12, 0, 0).toISOString()
    const end = new Date(2026, 10, 4, 12, 0, 0).toISOString()
    expect(
      formatDueRange({ due_date: end, start_date: start, is_all_day: true }, '24h'),
    ).toBe('Mon – Wed')
  })
})
