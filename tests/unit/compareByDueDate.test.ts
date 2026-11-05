import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compareByDueDate } from '../../shared/dueSchedule'

describe('compareByDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 5, 15, 0, 0)) // Thu Nov 5 2026 15:00 local
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('puts undated after dated', () => {
    const dated = {
      due_date: new Date(2026, 10, 5, 12, 0, 0).toISOString(),
      start_date: null,
      is_all_day: false,
    }
    const undated = { due_date: null, start_date: null, is_all_day: false }
    expect(compareByDueDate(dated, undated)).toBeLessThan(0)
    expect(compareByDueDate(undated, dated)).toBeGreaterThan(0)
  })

  it('puts overdue calendar days before today', () => {
    const overdue = {
      due_date: new Date(2026, 10, 4, 12, 0, 0).toISOString(),
      start_date: null,
      is_all_day: false,
    }
    const today = {
      due_date: new Date(2026, 10, 5, 18, 0, 0).toISOString(),
      start_date: null,
      is_all_day: false,
    }
    expect(compareByDueDate(overdue, today)).toBeLessThan(0)
  })

  it('puts date-only / all-day before timed tasks on the same day', () => {
    const noTime = {
      due_date: new Date(2026, 10, 5, 0, 0, 0).toISOString(),
      start_date: null,
      is_all_day: false,
    }
    const morning = {
      due_date: new Date(2026, 10, 5, 9, 0, 0).toISOString(),
      start_date: null,
      is_all_day: false,
    }
    const allDay = {
      due_date: new Date(2026, 10, 5, 12, 0, 0).toISOString(),
      start_date: new Date(2026, 10, 5, 12, 0, 0).toISOString(),
      is_all_day: true,
    }
    expect(compareByDueDate(noTime, morning)).toBeLessThan(0)
    expect(compareByDueDate(allDay, morning)).toBeLessThan(0)
  })

  it('orders timed tasks by start (duration) then due (point)', () => {
    const early = {
      due_date: new Date(2026, 10, 5, 11, 0, 0).toISOString(),
      start_date: new Date(2026, 10, 5, 9, 0, 0).toISOString(),
      is_all_day: false,
    }
    const late = {
      due_date: new Date(2026, 10, 5, 10, 0, 0).toISOString(),
      start_date: null,
      is_all_day: false,
    }
    // Duration 09–11 should sort before point due at 10:00
    expect(compareByDueDate(early, late)).toBeLessThan(0)
  })
})
