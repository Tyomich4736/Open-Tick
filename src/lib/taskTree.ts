import type { TaskListItem } from '@shared/entities'

export type FlatItem = {
  task: TaskListItem
  depth: number
  parentId: string | null
}

export function isTaskExpanded(
  task: TaskListItem,
  expandedTaskIds: Record<string, boolean>,
): boolean {
  return expandedTaskIds[task.id] ?? task.subtask_count > 0
}

export function sameIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

/** Collect parent ids that are expanded and may have children to load (any depth). */
export function collectExpandedParentIds(
  roots: TaskListItem[],
  expandedTaskIds: Record<string, boolean>,
  getChildren: (parentId: string) => TaskListItem[] | undefined,
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()

  const walk = (tasks: TaskListItem[]) => {
    for (const task of tasks) {
      if (!isTaskExpanded(task, expandedTaskIds) || task.subtask_count <= 0) continue
      if (seen.has(task.id)) continue
      seen.add(task.id)
      ids.push(task.id)
      const children = getChildren(task.id)
      if (children?.length) walk(children)
    }
  }

  walk(roots)
  return ids
}

export function isDescendant(
  taskId: string,
  possibleAncestorId: string,
  parentById: Map<string, string | null>,
): boolean {
  let current: string | null = taskId
  const seen = new Set<string>()
  while (current) {
    if (current === possibleAncestorId) return true
    if (seen.has(current)) break
    seen.add(current)
    current = parentById.get(current) ?? null
  }
  return false
}

export function flattenTaskTree(
  roots: TaskListItem[],
  expandedTaskIds: Record<string, boolean>,
  getChildren: (parentId: string) => TaskListItem[],
): FlatItem[] {
  const items: FlatItem[] = []

  const walk = (task: TaskListItem, depth: number, parentId: string | null) => {
    items.push({ task, depth, parentId })
    if (!isTaskExpanded(task, expandedTaskIds)) return
    for (const child of getChildren(task.id)) {
      walk(child, depth + 1, task.id)
    }
  }

  for (const task of roots) {
    walk(task, 0, null)
  }
  return items
}

export function reorderSiblingIds(
  siblingIds: string[],
  dragTaskId: string,
  insertIndex: number,
): string[] {
  const next = siblingIds.filter((id) => id !== dragTaskId)
  const clamped = Math.max(0, Math.min(insertIndex, next.length))
  next.splice(clamped, 0, dragTaskId)
  return next
}

export type DropPosition = 'before' | 'after' | 'into'
export type DropIndicator = { targetId: string; position: DropPosition }
