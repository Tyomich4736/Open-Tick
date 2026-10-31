import {
  isDescendant,
  reorderSiblingIds,
  rootAncestorId,
  sameIdOrder,
} from './taskTree'

export type DropPosition = 'before' | 'after' | 'into'
export type DropIndicator = { targetId: string; position: DropPosition }

/** Row hit-test. Cross-section never nests (middle → before/after). */
export function hitTestDropPosition(yRatio: number, crossSection: boolean): DropPosition {
  if (yRatio < 0.25) return 'before'
  if (yRatio > 0.75) return 'after'
  if (crossSection) return yRatio < 0.5 ? 'before' : 'after'
  return 'into'
}

/**
 * Adjacent same-parent reorder: "before" on the next sibling / "after" on the
 * previous is a no-op — flip to the swap direction. Keep "into" so nesting
 * onto a neighbour still works.
 */
export function adjustAdjacentReorderPosition(input: {
  position: DropPosition
  movingId: string
  targetId: string
  siblingIds: string[]
}): DropPosition {
  const { position, movingId, targetId, siblingIds } = input
  const from = siblingIds.indexOf(movingId)
  const to = siblingIds.indexOf(targetId)
  if (from < 0 || to < 0) return position
  if (from === to - 1 && position === 'before') return 'after'
  if (from === to + 1 && position === 'after') return 'before'
  return position
}

export type TaskDropPlan =
  | { type: 'noop' }
  | {
      type: 'nest'
      movingId: string
      fromParentId: string | null
      toParentId: string
    }
  | {
      type: 'relocate'
      movingId: string
      fromParentId: string | null
      /** null = become a root */
      toParentId: string | null
      siblingOrder: string[]
      /** undefined = leave section unchanged */
      sectionId?: string | null
    }

export function planRowDrop(input: {
  movingId: string
  targetId: string
  position: DropPosition
  crossSection: boolean
  sectionId: string | null | undefined
  fromParentId: string | null
  targetParentId: string | null
  rootIds: string[]
  getChildIds: (parentId: string) => string[]
  parentById: Map<string, string | null>
}): TaskDropPlan {
  const {
    movingId,
    targetId,
    position,
    crossSection,
    sectionId,
    fromParentId,
    targetParentId,
    rootIds,
    getChildIds,
    parentById,
  } = input

  if (movingId === targetId) return { type: 'noop' }

  let resolved = position
  if (crossSection && resolved === 'into') {
    resolved = 'after'
  }

  if (!crossSection && fromParentId === targetParentId) {
    const siblingIds =
      targetParentId === null ? rootIds : getChildIds(targetParentId)
    resolved = adjustAdjacentReorderPosition({
      position: resolved,
      movingId,
      targetId,
      siblingIds,
    })
  }

  if (resolved === 'into') {
    if (isDescendant(targetId, movingId, parentById)) return { type: 'noop' }
    if (fromParentId === targetId) return { type: 'noop' }
    return {
      type: 'nest',
      movingId,
      fromParentId,
      toParentId: targetId,
    }
  }

  // Cross-section: always land as a root beside the target's root ancestor.
  const toParentId = crossSection ? null : targetParentId
  const insertTargetId = crossSection
    ? rootAncestorId(targetId, parentById)
    : targetId
  const siblingIds = toParentId === null ? [...rootIds] : getChildIds(toParentId)

  const withoutMoving = siblingIds.filter((id) => id !== movingId)
  let insertAt = withoutMoving.indexOf(insertTargetId)
  if (insertAt < 0) insertAt = withoutMoving.length
  if (resolved === 'after') insertAt += 1

  const siblingOrder = reorderSiblingIds(siblingIds, movingId, insertAt)
  const parentChanged = fromParentId !== toParentId
  const orderChanged = !sameIdOrder(siblingIds, siblingOrder)
  const sectionChanged = crossSection && sectionId !== undefined

  if (!parentChanged && !orderChanged && !sectionChanged) return { type: 'noop' }

  return {
    type: 'relocate',
    movingId,
    fromParentId,
    toParentId,
    siblingOrder,
    ...(sectionChanged ? { sectionId } : {}),
  }
}

/** Append moving task as a root at the end of a section. */
export function planSectionDrop(input: {
  movingId: string
  sectionId: string | null
  fromParentId: string | null
  fromSectionId: string | null
  rootIds: string[]
  sectionIdOf: (taskId: string) => string | null
}): TaskDropPlan {
  const { movingId, sectionId, fromParentId, fromSectionId, rootIds, sectionIdOf } =
    input

  const withoutMoving = rootIds.filter((id) => id !== movingId)
  let insertAt = withoutMoving.length
  for (let i = withoutMoving.length - 1; i >= 0; i--) {
    if (sectionIdOf(withoutMoving[i]!) === sectionId) {
      insertAt = i + 1
      break
    }
  }
  const siblingOrder = [...withoutMoving]
  siblingOrder.splice(insertAt, 0, movingId)

  const sameSectionRoot =
    fromParentId === null && (fromSectionId ?? null) === (sectionId ?? null)
  const orderChanged = !sameIdOrder(rootIds, siblingOrder)

  if (sameSectionRoot && !orderChanged) return { type: 'noop' }

  return {
    type: 'relocate',
    movingId,
    fromParentId,
    toParentId: null,
    siblingOrder,
    ...(sameSectionRoot ? {} : { sectionId }),
  }
}

export type TaskDropPersistApi = {
  reorder: (orderedIds: string[]) => void
  update: (
    id: string,
    input: { parent_id?: string | null; section_id?: string | null },
  ) => void
}

/**
 * Persist half of a drop plan (SQLite / IPC). Cache / UI updates stay in the hook.
 * - nest → update parent_id
 * - relocate → reorder siblings; update parent/section when they change
 */
export function persistTaskDropPlan(plan: TaskDropPlan, api: TaskDropPersistApi): void {
  if (plan.type === 'noop') return

  if (plan.type === 'nest') {
    api.update(plan.movingId, { parent_id: plan.toParentId })
    return
  }

  api.reorder(plan.siblingOrder)

  const parentChanged = plan.fromParentId !== plan.toParentId
  const sectionChanged = plan.sectionId !== undefined
  if (parentChanged || sectionChanged) {
    api.update(plan.movingId, {
      ...(parentChanged ? { parent_id: plan.toParentId } : {}),
      ...(sectionChanged ? { section_id: plan.sectionId } : {}),
    })
  }
}
