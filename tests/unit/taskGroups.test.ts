import { describe, expect, it } from 'vitest'
import type { TaskListItem } from '../../shared/entities'
import { groupTasks } from '../../shared/taskGroups'

function task(overrides: Partial<TaskListItem>): TaskListItem {
  return {
    id: 't1',
    title: 'Task',
    status: 'pending',
    priority: 0,
    due_date: null,
    start_date: null,
    is_all_day: true,
    project_id: 'p1',
    project_name: 'Work',
    project_color: '#4772FA',
    project_is_inbox: false,
    tags: [],
    subtask_count: 0,
    completed_subtask_count: 0,
    created_at: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

describe('groupTasks', () => {
  it('returns a single unlabeled group when groupBy is none', () => {
    const items = [task({ id: 'a' }), task({ id: 'b' })]
    const groups = groupTasks(items, 'none')
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('')
    expect(groups[0].tasks.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('groups by priority high → none', () => {
    const items = [
      task({ id: 'low', priority: 1 }),
      task({ id: 'high', priority: 5 }),
      task({ id: 'none', priority: 0 }),
    ]
    const groups = groupTasks(items, 'priority')
    expect(groups.map((g) => g.label)).toEqual(['High', 'Low', 'None'])
    expect(groups[0].tasks[0].id).toBe('high')
  })

  it('groups by list with Inbox first', () => {
    const items = [
      task({ id: 'w', project_id: 'p2', project_name: 'Work', project_is_inbox: false }),
      task({
        id: 'i',
        project_id: 'inbox',
        project_name: 'Inbox',
        project_is_inbox: true,
      }),
    ]
    const groups = groupTasks(items, 'list')
    expect(groups[0].label).toBe('Inbox')
    expect(groups[0].tasks[0].id).toBe('i')
    expect(groups[1].label).toBe('Work')
  })

  it('groups by first alphabetical tag', () => {
    const items = [
      task({ id: 'a', tags: ['zebra', 'apple'] }),
      task({ id: 'b', tags: [] }),
    ]
    const groups = groupTasks(items, 'tag')
    expect(groups.map((g) => g.label)).toEqual(['#apple', 'No tags'])
    expect(groups[0].tasks[0].id).toBe('a')
  })

  it('groups undated tasks under No date', () => {
    const items = [
      task({ id: 'dated', due_date: '2026-10-21T12:00:00.000Z' }),
      task({ id: 'undated', due_date: null }),
    ]
    const groups = groupTasks(items, 'date')
    expect(groups.at(-1)?.label).toBe('No date')
    expect(groups.at(-1)?.tasks[0].id).toBe('undated')
  })
})
