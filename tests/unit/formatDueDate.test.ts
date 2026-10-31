import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, format, startOfDay } from 'date-fns'
import { formatDayPart, formatDueDate } from '../../src/lib/formatDueDate'

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
