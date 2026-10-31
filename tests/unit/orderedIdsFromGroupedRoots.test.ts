import { describe, expect, it } from 'vitest'
import { orderedIdsFromGroupedRoots } from '../../src/lib/taskTree'
import type { TaskListItem } from '../../shared/entities'

function root(id: string, sectionId: string): TaskListItem {
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
})
