import { describe, expect, it, vi, afterEach } from 'vitest'
import { applyDueDaysFromNow } from '../../shared/dueSchedule'

describe('applyDueDaysFromNow', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves a timed due date to tomorrow and keeps the clock time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 15, 0, 0)) // Wed Oct 14 2026 local

    const result = applyDueDaysFromNow(
      {
        due_date: new Date(2026, 9, 10, 18, 30, 0).toISOString(),
        start_date: null,
        is_all_day: false,
      },
      1,
    )

    expect(result.is_all_day).toBe(false)
    const due = new Date(result.due_date!)
    expect(due.getFullYear()).toBe(2026)
    expect(due.getMonth()).toBe(9)
    expect(due.getDate()).toBe(15)
    expect(due.getHours()).toBe(18)
    expect(due.getMinutes()).toBe(30)
  })

  it('shifts start_date by the same day delta for timed duration tasks', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0))

    const result = applyDueDaysFromNow(
      {
        due_date: new Date(2026, 9, 10, 17, 0, 0).toISOString(),
        start_date: new Date(2026, 9, 10, 15, 0, 0).toISOString(),
        is_all_day: false,
      },
      1,
    )

    const start = new Date(result.start_date!)
    const due = new Date(result.due_date!)
    expect(start.getDate()).toBe(15)
    expect(start.getHours()).toBe(15)
    expect(due.getDate()).toBe(15)
    expect(due.getHours()).toBe(17)
  })

  it('moves date-only (No time) without turning it into an all-day event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0))

    const result = applyDueDaysFromNow(
      {
        due_date: new Date(2026, 9, 10, 0, 0, 0).toISOString(),
        start_date: null,
        is_all_day: false,
      },
      1,
    )

    expect(result.is_all_day).toBe(false)
    expect(result.start_date).toBeNull()
    const due = new Date(result.due_date!)
    expect(due.getDate()).toBe(15)
    expect(due.getHours()).toBe(0)
    expect(due.getMinutes()).toBe(0)
  })

  it('keeps all-day events all-day when shifting the span', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12, 0, 0))

    const result = applyDueDaysFromNow(
      {
        due_date: new Date(2026, 9, 11, 12, 0, 0).toISOString(),
        start_date: new Date(2026, 9, 10, 12, 0, 0).toISOString(),
        is_all_day: true,
      },
      1,
    )

    expect(result.is_all_day).toBe(true)
    expect(new Date(result.due_date!).getDate()).toBe(15)
    expect(new Date(result.start_date!).getDate()).toBe(14)
  })

  it('clears due and start', () => {
    const result = applyDueDaysFromNow(
      {
        due_date: new Date(2026, 9, 10, 18, 0, 0).toISOString(),
        start_date: new Date(2026, 9, 10, 17, 0, 0).toISOString(),
        is_all_day: false,
      },
      null,
    )
    expect(result).toEqual({
      due_date: null,
      start_date: null,
      is_all_day: false,
    })
  })
})
