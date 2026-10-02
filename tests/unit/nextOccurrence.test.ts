import { describe, expect, it } from 'vitest'
import { addDays } from 'date-fns'
import { nextOccurrenceDates } from '../../shared/nextOccurrence'
import { defaultRecurrence } from '../../shared/recurrence'

describe('nextOccurrenceDates', () => {
  it('advances daily by interval', () => {
    const due = '2026-08-28T12:00:00.000Z'
    const result = nextOccurrenceDates(
      { ...defaultRecurrence('daily'), interval: 2 },
      { due_date: due, start_date: null },
    )
    expect(result).not.toBeNull()
    expect(result!.due_date).toBe(addDays(new Date(due), 2).toISOString())
    expect(result!.rule.completed_count).toBe(1)
  })

  it('stops after count', () => {
    const result = nextOccurrenceDates(
      {
        ...defaultRecurrence('daily'),
        end: { type: 'after_count', count: 1 },
        completed_count: 0,
      },
      { due_date: '2026-08-28T12:00:00.000Z', start_date: null },
    )
    expect(result).toBeNull()
  })

  it('preserves start/due span', () => {
    const start = '2026-08-27T12:00:00.000Z'
    const due = '2026-08-28T12:00:00.000Z'
    const result = nextOccurrenceDates(defaultRecurrence('daily'), {
      due_date: due,
      start_date: start,
    })
    expect(result!.start_date).toBe(addDays(new Date(start), 1).toISOString())
    expect(result!.due_date).toBe(addDays(new Date(due), 1).toISOString())
  })

  it('weekly with multiple weekdays advances to the next listed day', () => {
    const monday = '2026-09-28T12:00:00.000Z'
    const result = nextOccurrenceDates(
      { ...defaultRecurrence('weekly'), weekdays: [1, 3, 5] },
      { due_date: monday, start_date: null },
    )
    expect(result!.due_date).toBe('2026-09-30T12:00:00.000Z') // Wednesday
  })
})
