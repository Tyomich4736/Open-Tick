import { describe, expect, it } from 'vitest'
import { expandTasksForCalendarRange } from '../../shared/expandRecurrence'
import type { TaskListItem } from '../../shared/entities'
import { defaultRecurrence } from '../../shared/recurrence'

function baseTask(overrides: Partial<TaskListItem> = {}): TaskListItem {
  return {
    id: 't1',
    title: 'Daily standup',
    status: 'pending',
    priority: 0,
    due_date: '2026-09-01T10:00:00.000Z',
    start_date: null,
    is_all_day: false,
    project_id: 'p1',
    project_name: 'Work',
    project_color: '#4772FA',
    project_is_inbox: false,
    tags: [],
    subtask_count: 0,
    completed_subtask_count: 0,
    recurrence_rule: defaultRecurrence('daily'),
    ...overrides,
  }
}

describe('expandTasksForCalendarRange', () => {
  it('passes through non-recurring tasks that overlap the range', () => {
    const task = baseTask({
      id: 'plain',
      recurrence_rule: null,
      due_date: '2026-09-05T12:00:00.000Z',
    })
    const start = new Date('2026-09-01T00:00:00.000Z')
    const end = new Date('2026-09-07T23:59:59.999Z')
    const out = expandTasksForCalendarRange([task], start, end)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('plain')
  })

  it('expands daily recurrence across the visible range', () => {
    const task = baseTask()
    const start = new Date('2026-09-01T00:00:00.000Z')
    const end = new Date('2026-09-03T23:59:59.999Z')
    const out = expandTasksForCalendarRange([task], start, end)
    expect(out.length).toBeGreaterThanOrEqual(3)
    expect(new Set(out.map((t) => t.instance_key)).size).toBe(out.length)
    expect(out.every((t) => t.id === 't1')).toBe(true)
  })

  it('respects after_count end of series', () => {
    const task = baseTask({
      recurrence_rule: {
        ...defaultRecurrence('daily'),
        end: { type: 'after_count', count: 2 },
        completed_count: 0,
      },
    })
    const start = new Date('2026-09-01T00:00:00.000Z')
    const end = new Date('2026-09-30T23:59:59.999Z')
    const out = expandTasksForCalendarRange([task], start, end)
    // current + one more (completed_count advances; after 2nd completion series ends)
    expect(out.length).toBeLessThanOrEqual(2)
    expect(out.length).toBeGreaterThanOrEqual(1)
  })
})
