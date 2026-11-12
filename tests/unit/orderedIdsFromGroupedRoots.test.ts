import { describe, expect, it } from 'vitest'
import { orderedIdsFromGroupedRoots } from '../../src/lib/taskTree'
import type { TaskListItem } from '../../shared/entities'

function root(
  id: string,
  sectionId: string,
  overrides: Partial<TaskListItem> = {},
): TaskListItem {
  return {
    id,
    title: id,
    status: 'pending',
    priority: 0,
    due_date: null,
    start_date: null,
    is_all_day: true,
    project_id: 'p',
    project_name: 'P',
    project_color: '',
    project_is_inbox: false,
    section_id: sectionId,
    section_name: sectionId,
    section_sort: sectionId === 'A' ? 0 : 1,
    tags: [],
    subtask_count: 0,
    completed_subtask_count: 0,
    created_at: '',
    ...overrides,
  }
}

describe('orderedIdsFromGroupedRoots', () => {
  it('follows section visual order, not interleaved sort_order', () => {
    // Global sort_order might be A1, B1, A2 — UI shows A then B.
    const sectionA = [root('a1', 'A'), root('a2', 'A')]
    const sectionB = [root('b1', 'B'), root('b2', 'B')]
    const ids = orderedIdsFromGroupedRoots([sectionA, sectionB], {}, () => [])
    expect(ids).toEqual(['a1', 'a2', 'b1', 'b2'])
  })

  it('shift range inside one section does not include the other', () => {
    const sectionA = [root('a1', 'A'), root('a2', 'A'), root('a3', 'A')]
    const sectionB = [root('b1', 'B')]
    const ids = orderedIdsFromGroupedRoots([sectionA, sectionB], {}, () => [])
    const start = ids.indexOf('a1')
    const end = ids.indexOf('a3')
    expect(ids.slice(start, end + 1)).toEqual(['a1', 'a2', 'a3'])
    expect(ids.slice(start, end + 1)).not.toContain('b1')
  })

  it('includes expanded children in visual order; shift across sections stays contiguous', () => {
    const sectionA = [
      root('a1', 'A', { subtask_count: 2 }),
      root('a2', 'A'),
    ]
    const sectionB = [root('b1', 'B', { subtask_count: 1 })]
    const children: Record<string, TaskListItem[]> = {
      a1: [root('a1c1', 'A'), root('a1c2', 'A')],
      b1: [root('b1c1', 'B')],
    }
    const expanded = { a1: true, b1: true }
    const ids = orderedIdsFromGroupedRoots(
      [sectionA, sectionB],
      expanded,
      (parentId) => children[parentId] ?? [],
    )
    expect(ids).toEqual(['a1', 'a1c1', 'a1c2', 'a2', 'b1', 'b1c1'])

    // Shift from a1 → a2 includes children of a1, not section B.
    expect(ids.slice(ids.indexOf('a1'), ids.indexOf('a2') + 1)).toEqual([
      'a1',
      'a1c1',
      'a1c2',
      'a2',
    ])
    expect(ids.slice(ids.indexOf('a1'), ids.indexOf('a2') + 1)).not.toContain('b1')

    // Shift from a2 → b1 includes b1 but not b1's children after end if end is b1...
    // Range a2..b1 is contiguous on-screen.
    expect(ids.slice(ids.indexOf('a2'), ids.indexOf('b1') + 1)).toEqual(['a2', 'b1'])
  })
})
