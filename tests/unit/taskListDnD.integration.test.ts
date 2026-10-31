import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDatabaseInstance,
  openDatabase,
  type Repositories,
} from '../../electron/main/db/openDatabase'
import { groupTasksBySection } from '../../shared/taskGroups'
import {
  persistTaskDropPlan,
  planRowDrop,
  planSectionDrop,
} from '../../src/lib/taskListDnD'

type Seed = {
  projectId: string
  notSectionedId: string
  todoId: string
  doingId: string
  /** Roots in global sort order: ns1, todo1, todo2, doing1, parent */
  ns1: string
  todo1: string
  todo2: string
  doing1: string
  parent: string
  child1: string
  child2: string
}

function seedList(repos: Repositories): Seed {
  const project = repos.projects.create({ name: 'QA List' })
  const todo = repos.sections.create({ project_id: project.id, name: 'Todo' })
  const doing = repos.sections.create({ project_id: project.id, name: 'Doing' })
  const notSectioned = repos.sections.getDefaultForProject(project.id)!

  const ns1 = repos.tasks.create({
    title: 'ns1',
    project_id: project.id,
    section_id: notSectioned.id,
  })
  const todo1 = repos.tasks.create({
    title: 'todo1',
    project_id: project.id,
    section_id: todo.id,
  })
  const todo2 = repos.tasks.create({
    title: 'todo2',
    project_id: project.id,
    section_id: todo.id,
  })
  const doing1 = repos.tasks.create({
    title: 'doing1',
    project_id: project.id,
    section_id: doing.id,
  })
  const parent = repos.tasks.create({
    title: 'parent',
    project_id: project.id,
    section_id: doing.id,
  })
  const child1 = repos.tasks.create({
    title: 'child1',
    project_id: project.id,
    parent_id: parent.id,
    section_id: doing.id,
  })
  const child2 = repos.tasks.create({
    title: 'child2',
    project_id: project.id,
    parent_id: parent.id,
    section_id: doing.id,
  })

  // Contiguous global root order matching section visual order.
  repos.tasks.reorder([ns1.id, todo1.id, todo2.id, doing1.id, parent.id])

  return {
    projectId: project.id,
    notSectionedId: notSectioned.id,
    todoId: todo.id,
    doingId: doing.id,
    ns1: ns1.id,
    todo1: todo1.id,
    todo2: todo2.id,
    doing1: doing1.id,
    parent: parent.id,
    child1: child1.id,
    child2: child2.id,
  }
}

function readRoots(repos: Repositories, projectId: string) {
  return repos.tasks.list({ project_id: projectId, parent_id: null, sort: 'order' })
}

function readChildren(repos: Repositories, parentId: string) {
  return repos.tasks.list({ parent_id: parentId, sort: 'order' })
}

function readGroups(repos: Repositories, projectId: string) {
  const roots = readRoots(repos, projectId)
  const sections = repos.sections.listByProject(projectId)
  return groupTasksBySection(roots, sections)
}

function dndContext(repos: Repositories, projectId: string) {
  const roots = readRoots(repos, projectId)
  const parentById = new Map<string, string | null>()
  const childrenByParent = new Map<string, string[]>()

  for (const root of roots) {
    parentById.set(root.id, null)
    if (root.subtask_count > 0) {
      const kids = readChildren(repos, root.id)
      childrenByParent.set(
        root.id,
        kids.map((k) => k.id),
      )
      for (const kid of kids) parentById.set(kid.id, root.id)
    }
  }

  return {
    roots,
    rootIds: roots.map((r) => r.id),
    parentById,
    getChildIds: (parentId: string) => childrenByParent.get(parentId) ?? [],
    sectionIdOf: (taskId: string) => {
      const fromRoot = roots.find((r) => r.id === taskId)
      if (fromRoot) return fromRoot.section_id
      return repos.tasks.getById(taskId)?.section_id ?? null
    },
  }
}

function applyPlan(repos: Repositories, plan: Parameters<typeof persistTaskDropPlan>[0]) {
  persistTaskDropPlan(plan, {
    reorder: (ids) => repos.tasks.reorder(ids),
    update: (id, input) => {
      repos.tasks.update(id, input)
    },
  })
}

describe('task list DnD integration', () => {
  let repos: Repositories
  let seed: Seed

  beforeEach(() => {
    repos = openDatabase(':memory:')
    seed = seedList(repos)
  })

  afterEach(() => {
    closeDatabaseInstance(repos.db)
  })

  describe('sectioning', () => {
    it('groups roots with empty Todo still present', () => {
      // Empty Todo: move both todo tasks out first via direct update for setup clarity
      repos.tasks.update(seed.todo1, { section_id: seed.doingId })
      repos.tasks.update(seed.todo2, { section_id: seed.doingId })

      const groups = readGroups(repos, seed.projectId)
      expect(groups.map((g) => g.label)).toEqual(['Not Sectioned', 'Todo', 'Doing'])
      expect(groups.find((g) => g.label === 'Todo')?.tasks).toHaveLength(0)
      expect(groups.find((g) => g.label === 'Doing')?.tasks.map((t) => t.title).sort()).toEqual(
        ['doing1', 'parent', 'todo1', 'todo2'].sort(),
      )
    })

    it('planSectionDrop moves a root into Doing and keeps empty source section', () => {
      const ctx = dndContext(repos, seed.projectId)
      const plan = planSectionDrop({
        movingId: seed.todo1,
        sectionId: seed.doingId,
        fromParentId: null,
        fromSectionId: seed.todoId,
        rootIds: ctx.rootIds,
        sectionIdOf: ctx.sectionIdOf,
      })
      expect(plan.type).toBe('relocate')
      applyPlan(repos, plan)

      const moved = repos.tasks.getById(seed.todo1)
      expect(moved?.section_id).toBe(seed.doingId)
      expect(moved?.parent_id).toBeNull()

      const groups = readGroups(repos, seed.projectId)
      expect(groups.find((g) => g.label === 'Todo')?.tasks.map((t) => t.id)).toEqual([seed.todo2])
      const doingIds = groups.find((g) => g.label === 'Doing')?.tasks.map((t) => t.id) ?? []
      expect(doingIds).toContain(seed.todo1)
      expect(doingIds.at(-1)).toBe(seed.todo1)
      // Empty-capable: Todo still listed (has todo2); Not Sectioned still present
      expect(groups.map((g) => g.label)).toEqual(['Not Sectioned', 'Todo', 'Doing'])
    })

    it('cross-section drop onto a nested row inserts beside the root ancestor in target section', () => {
      const ctx = dndContext(repos, seed.projectId)
      const plan = planRowDrop({
        movingId: seed.todo1,
        targetId: seed.child1,
        position: 'before',
        crossSection: true,
        sectionId: seed.doingId,
        fromParentId: null,
        targetParentId: seed.parent,
        rootIds: ctx.rootIds,
        getChildIds: ctx.getChildIds,
        parentById: ctx.parentById,
      })
      expect(plan.type).toBe('relocate')
      applyPlan(repos, plan)

      const moved = repos.tasks.getById(seed.todo1)
      expect(moved?.parent_id).toBeNull()
      expect(moved?.section_id).toBe(seed.doingId)

      const rootIds = readRoots(repos, seed.projectId).map((t) => t.id)
      const parentIdx = rootIds.indexOf(seed.parent)
      expect(rootIds[parentIdx - 1]).toBe(seed.todo1)
      expect(readChildren(repos, seed.parent).map((t) => t.id)).toEqual([
        seed.child1,
        seed.child2,
      ])
    })
  })

  describe('drag position', () => {
    it('swaps adjacent roots within a section (before → after identity flip)', () => {
      const ctx = dndContext(repos, seed.projectId)
      const plan = planRowDrop({
        movingId: seed.todo1,
        targetId: seed.todo2,
        position: 'before',
        crossSection: false,
        sectionId: undefined,
        fromParentId: null,
        targetParentId: null,
        rootIds: ctx.rootIds,
        getChildIds: ctx.getChildIds,
        parentById: ctx.parentById,
      })
      expect(plan.type).toBe('relocate')
      if (plan.type === 'relocate') {
        expect(plan.siblingOrder).toEqual([
          seed.ns1,
          seed.todo2,
          seed.todo1,
          seed.doing1,
          seed.parent,
        ])
      }
      applyPlan(repos, plan)

      expect(readRoots(repos, seed.projectId).map((t) => t.id)).toEqual([
        seed.ns1,
        seed.todo2,
        seed.todo1,
        seed.doing1,
        seed.parent,
      ])
      expect(repos.tasks.getById(seed.todo1)?.section_id).toBe(seed.todoId)
    })

    it('reorders subtasks under one parent', () => {
      const ctx = dndContext(repos, seed.projectId)
      expect(ctx.getChildIds(seed.parent)).toEqual([seed.child1, seed.child2])

      const plan = planRowDrop({
        movingId: seed.child1,
        targetId: seed.child2,
        position: 'before',
        crossSection: false,
        sectionId: undefined,
        fromParentId: seed.parent,
        targetParentId: seed.parent,
        rootIds: ctx.rootIds,
        getChildIds: ctx.getChildIds,
        parentById: ctx.parentById,
      })
      expect(plan.type).toBe('relocate')
      applyPlan(repos, plan)

      expect(readChildren(repos, seed.parent).map((t) => t.id)).toEqual([
        seed.child2,
        seed.child1,
      ])
      expect(readRoots(repos, seed.projectId).map((t) => t.id)).toContain(seed.parent)
      expect(readRoots(repos, seed.projectId).map((t) => t.id)).not.toContain(seed.child1)
    })
  })

  describe('subtasks moving', () => {
    it('nests a root into another: leaves roots, appears under target, updates subtask_count', () => {
      const ctx = dndContext(repos, seed.projectId)
      const plan = planRowDrop({
        movingId: seed.doing1,
        targetId: seed.parent,
        position: 'into',
        crossSection: false,
        sectionId: undefined,
        fromParentId: null,
        targetParentId: null,
        rootIds: ctx.rootIds,
        getChildIds: ctx.getChildIds,
        parentById: ctx.parentById,
      })
      expect(plan).toEqual({
        type: 'nest',
        movingId: seed.doing1,
        fromParentId: null,
        toParentId: seed.parent,
      })
      applyPlan(repos, plan)

      expect(repos.tasks.getById(seed.doing1)?.parent_id).toBe(seed.parent)
      const roots = readRoots(repos, seed.projectId)
      expect(roots.map((t) => t.id)).not.toContain(seed.doing1)
      const parentRow = roots.find((t) => t.id === seed.parent)
      expect(parentRow?.subtask_count).toBe(3)
      expect(readChildren(repos, seed.parent).map((t) => t.id)).toContain(seed.doing1)
    })

    it('promotes a subtask to root beside another root', () => {
      const ctx = dndContext(repos, seed.projectId)
      const plan = planRowDrop({
        movingId: seed.child1,
        targetId: seed.doing1,
        position: 'before',
        crossSection: false,
        sectionId: undefined,
        fromParentId: seed.parent,
        targetParentId: null,
        rootIds: ctx.rootIds,
        getChildIds: ctx.getChildIds,
        parentById: ctx.parentById,
      })
      expect(plan.type).toBe('relocate')
      applyPlan(repos, plan)

      expect(repos.tasks.getById(seed.child1)?.parent_id).toBeNull()
      const rootIds = readRoots(repos, seed.projectId).map((t) => t.id)
      expect(rootIds).toContain(seed.child1)
      expect(rootIds.indexOf(seed.child1)).toBe(rootIds.indexOf(seed.doing1) - 1)
      expect(readChildren(repos, seed.parent).map((t) => t.id)).toEqual([seed.child2])
      expect(rootsSubtaskCount(repos, seed.projectId, seed.parent)).toBe(1)
    })

    it('moving a parent to another section keeps children attached under that parent', () => {
      const ctx = dndContext(repos, seed.projectId)
      const plan = planSectionDrop({
        movingId: seed.parent,
        sectionId: seed.todoId,
        fromParentId: null,
        fromSectionId: seed.doingId,
        rootIds: ctx.rootIds,
        sectionIdOf: ctx.sectionIdOf,
      })
      expect(plan.type).toBe('relocate')
      applyPlan(repos, plan)

      expect(repos.tasks.getById(seed.parent)?.section_id).toBe(seed.todoId)
      expect(repos.tasks.getById(seed.parent)?.parent_id).toBeNull()

      // Children stay linked by parent_id (subtree follows visually).
      expect(repos.tasks.getById(seed.child1)?.parent_id).toBe(seed.parent)
      expect(repos.tasks.getById(seed.child2)?.parent_id).toBe(seed.parent)
      expect(readChildren(repos, seed.parent).map((t) => t.id)).toEqual([
        seed.child1,
        seed.child2,
      ])

      const groups = readGroups(repos, seed.projectId)
      expect(groups.find((g) => g.label === 'Todo')?.tasks.map((t) => t.id)).toContain(
        seed.parent,
      )
      expect(groups.find((g) => g.label === 'Doing')?.tasks.map((t) => t.id)).not.toContain(
        seed.parent,
      )
      // Children are not roots — they must not appear as section roots
      expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).not.toContain(seed.child1)
    })
  })
})

function rootsSubtaskCount(repos: Repositories, projectId: string, taskId: string): number {
  return readRoots(repos, projectId).find((t) => t.id === taskId)?.subtask_count ?? -1
}
