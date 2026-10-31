import { describe, expect, it } from 'vitest'
import {
  adjustAdjacentReorderPosition,
  hitTestDropPosition,
  planRowDrop,
  planSectionDrop,
} from '../../src/lib/taskListDnD'
import { rootAncestorId } from '../../src/lib/taskTree'

describe('hitTestDropPosition', () => {
  it('keeps into for same-section middle of row', () => {
    expect(hitTestDropPosition(0.5, false)).toBe('into')
  })

  it('maps cross-section middle of row to before/after (never into)', () => {
    expect(hitTestDropPosition(0.4, true)).toBe('before')
    expect(hitTestDropPosition(0.6, true)).toBe('after')
  })

  it('preserves edge before/after either way', () => {
    expect(hitTestDropPosition(0.1, true)).toBe('before')
    expect(hitTestDropPosition(0.9, false)).toBe('after')
  })
})

describe('rootAncestorId', () => {
  it('returns self for roots and walks nested parents', () => {
    const parentById = new Map<string, string | null>([
      ['root', null],
      ['child', 'root'],
      ['grand', 'child'],
    ])
    expect(rootAncestorId('root', parentById)).toBe('root')
    expect(rootAncestorId('child', parentById)).toBe('root')
    expect(rootAncestorId('grand', parentById)).toBe('root')
  })
})

describe('adjustAdjacentReorderPosition', () => {
  const siblings = ['t1', 't2', 't3', 't4', 't5']

  it('flips identity before/after on adjacent siblings, keeps into for nesting', () => {
    expect(
      adjustAdjacentReorderPosition({
        position: 'before',
        movingId: 't4',
        targetId: 't5',
        siblingIds: siblings,
      }),
    ).toBe('after')
    expect(
      adjustAdjacentReorderPosition({
        position: 'into',
        movingId: 't4',
        targetId: 't5',
        siblingIds: siblings,
      }),
    ).toBe('into')
    expect(
      adjustAdjacentReorderPosition({
        position: 'after',
        movingId: 't5',
        targetId: 't4',
        siblingIds: siblings,
      }),
    ).toBe('before')
    expect(
      adjustAdjacentReorderPosition({
        position: 'into',
        movingId: 't5',
        targetId: 't4',
        siblingIds: siblings,
      }),
    ).toBe('into')
  })
})

describe('planRowDrop', () => {
  const parentById = new Map<string, string | null>([
    ['a1', null],
    ['a2', null],
    ['b1', null],
    ['b1-child', 'b1'],
    ['b2', null],
  ])
  const rootIds = ['a1', 'a2', 'b1', 'b2']
  const getChildIds = (parentId: string) => (parentId === 'b1' ? ['b1-child'] : [])

  it('nests into an adjacent neighbour (middle drop)', () => {
    const plan = planRowDrop({
      movingId: 'a1',
      targetId: 'a2',
      position: 'into',
      crossSection: false,
      sectionId: undefined,
      fromParentId: null,
      targetParentId: null,
      rootIds,
      getChildIds,
      parentById,
    })
    expect(plan).toEqual({
      type: 'nest',
      movingId: 'a1',
      fromParentId: null,
      toParentId: 'a2',
    })
  })

  it('swaps with next sibling when dropping before (identity → after)', () => {
    const plan = planRowDrop({
      movingId: 't4',
      targetId: 't5',
      position: 'before',
      crossSection: false,
      sectionId: undefined,
      fromParentId: null,
      targetParentId: null,
      rootIds: ['t1', 't2', 't3', 't4', 't5'],
      getChildIds: () => [],
      parentById: new Map(
        ['t1', 't2', 't3', 't4', 't5'].map((id) => [id, null as string | null]),
      ),
    })
    expect(plan.type).toBe('relocate')
    if (plan.type === 'relocate') {
      expect(plan.siblingOrder).toEqual(['t1', 't2', 't3', 't5', 't4'])
      expect(plan.toParentId).toBeNull()
    }
  })

  it('promotes a subtask to root beside another root', () => {
    const plan = planRowDrop({
      movingId: 'b1-child',
      targetId: 'b2',
      position: 'before',
      crossSection: false,
      sectionId: undefined,
      fromParentId: 'b1',
      targetParentId: null,
      rootIds,
      getChildIds,
      parentById,
    })
    expect(plan.type).toBe('relocate')
    if (plan.type === 'relocate') {
      expect(plan.fromParentId).toBe('b1')
      expect(plan.toParentId).toBeNull()
      expect(plan.siblingOrder).toEqual(['a1', 'a2', 'b1', 'b1-child', 'b2'])
    }
  })

  it('cross-section onto a nested row inserts beside the root ancestor', () => {
    const plan = planRowDrop({
      movingId: 'a1',
      targetId: 'b1-child',
      position: 'before',
      crossSection: true,
      sectionId: 'sec-b',
      fromParentId: null,
      targetParentId: 'b1',
      rootIds,
      getChildIds,
      parentById,
    })
    expect(plan.type).toBe('relocate')
    if (plan.type === 'relocate') {
      expect(plan.toParentId).toBeNull()
      expect(plan.sectionId).toBe('sec-b')
      expect(plan.siblingOrder).toEqual(['a2', 'a1', 'b1', 'b2'])
    }
  })
})

describe('planSectionDrop', () => {
  const sectionOf: Record<string, string> = {
    a1: 'A',
    a2: 'A',
    b1: 'B',
    b2: 'B',
  }

  it('moves a mid-section root to the end of its section', () => {
    const plan = planSectionDrop({
      movingId: 'a1',
      sectionId: 'A',
      fromParentId: null,
      fromSectionId: 'A',
      rootIds: ['a1', 'a2', 'b1', 'b2'],
      sectionIdOf: (id) => sectionOf[id] ?? null,
    })
    expect(plan.type).toBe('relocate')
    if (plan.type === 'relocate') {
      expect(plan.siblingOrder).toEqual(['a2', 'a1', 'b1', 'b2'])
      expect(plan.sectionId).toBeUndefined()
    }
  })

  it('no-ops when already last in section', () => {
    const plan = planSectionDrop({
      movingId: 'a2',
      sectionId: 'A',
      fromParentId: null,
      fromSectionId: 'A',
      rootIds: ['a1', 'a2', 'b1', 'b2'],
      sectionIdOf: (id) => sectionOf[id] ?? null,
    })
    expect(plan).toEqual({ type: 'noop' })
  })
})
