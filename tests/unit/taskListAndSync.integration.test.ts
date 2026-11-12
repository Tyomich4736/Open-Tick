/**
 * Integration coverage for task-list queries + TickTick pull/push mapping.
 * Wires remote DTO → mapper → SQLite → list filters → outbound payload
 * the same way SyncEngine / pushDirty do (without Electron / live API).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDatabaseInstance,
  openDatabase,
  type Repositories,
} from '../../electron/main/db/openDatabase'
import {
  localTaskToRemote,
  remoteTaskToLocal,
} from '../../electron/main/sync/mappers'
import { classifyVanishedTask } from '../../electron/main/sync/reconcileVanished'
import {
  resolveSectionIdForPull,
  upsertRemoteColumns,
} from '../../electron/main/sync/sectionPull'
import type { RemoteTask } from '../../electron/main/ticktick/remoteTypes'
import { isDateOnlySchedule } from '../../shared/dueSchedule'
import { groupTasksBySection } from '../../shared/taskGroups'
import { normalizeDateOnlyInstant } from '../../shared/taskDates'
import { defaultRecurrence } from '../../shared/recurrence'
import { addDays, parseISO } from 'date-fns'

const TZ = 'Europe/Minsk'
const PROJECT_REMOTE = 'proj-work'

function pullRemoteTasks(
  repos: Repositories,
  projectId: string,
  remotes: RemoteTask[],
  options?: { skipDirty?: boolean },
): { upserted: number; skippedDirty: number } {
  const mapped = remotes.map(remoteTaskToLocal)
  const ordered = [
    ...mapped.filter((t) => !t.parent_remote_id),
    ...mapped.filter((t) => t.parent_remote_id),
  ]
  const remoteToLocal = new Map<string, string>()
  for (const m of ordered) {
    const existing = repos.tasks.getByRemoteId(m.remote_id)
    if (existing) remoteToLocal.set(m.remote_id, existing.id)
  }

  let upserted = 0
  let skippedDirty = 0
  for (const m of ordered) {
    const existing = repos.tasks.getByRemoteId(m.remote_id)
    if (existing && existing.sync_status !== 'synced') {
      if (
        options?.skipDirty !== false &&
        m.status === 'completed' &&
        existing.status !== 'completed' &&
        !existing.deleted_at
      ) {
        repos.tasks.applyRemoteCompletion(existing.id, m.completed_at)
        remoteToLocal.set(m.remote_id, existing.id)
        upserted += 1
      } else {
        skippedDirty += 1
      }
      continue
    }

    let parentId: string | null = null
    if (m.parent_remote_id) {
      parentId =
        remoteToLocal.get(m.parent_remote_id) ??
        repos.tasks.getByRemoteId(m.parent_remote_id)?.id ??
        null
    }

    const sectionId = resolveSectionIdForPull(
      repos,
      m.column_remote_id,
      existing?.section_id ?? null,
      projectId,
    )

    const task = repos.tasks.upsertFromRemote({
      remote_id: m.remote_id,
      project_id: projectId,
      parent_id: parentId,
      section_id: sectionId,
      title: m.title,
      content: m.content,
      priority: m.priority,
      status: m.status,
      due_date: m.due_date,
      start_date: m.start_date,
      is_all_day: m.is_all_day,
      time_zone: m.time_zone,
      recurrence_rule: m.recurrence_rule,
      sort_order: m.sort_order,
      remote_updated_at: m.remote_updated_at,
      completed_at: m.completed_at,
      tags: m.tags,
      reminders: m.reminders,
    })
    remoteToLocal.set(m.remote_id, task.id)
    upserted += 1
  }
  return { upserted, skippedDirty }
}

function pushPayloadForLocal(repos: Repositories, taskId: string) {
  const task = repos.tasks.getById(taskId)
  if (!task) throw new Error(`missing task ${taskId}`)
  const project = repos.projects.getById(task.project_id)
  if (!project?.remote_id) throw new Error('project has no remote id')

  let columnRemoteId: string | null = null
  if (task.section_id) {
    const section = repos.sections.getById(task.section_id)
    if (section?.is_default && !section.remote_id) columnRemoteId = null
    else columnRemoteId = section?.remote_id ?? null
  }

  let parentRemoteId: string | null = null
  if (task.parent_id) {
    parentRemoteId = repos.tasks.getById(task.parent_id)?.remote_id ?? null
  }

  return localTaskToRemote({
    title: task.title,
    content: task.content,
    projectRemoteId: project.remote_id,
    parentRemoteId,
    columnRemoteId,
    priority: task.priority,
    status: task.status,
    due_date: task.due_date,
    start_date: task.start_date,
    is_all_day: task.is_all_day,
    time_zone: task.time_zone,
    tags: repos.tags.getTagsForTask(task.id),
    reminders: repos.reminders.listForTask(task.id).map((r) => ({
      kind: r.kind,
      offset_minutes: r.offset_minutes,
    })),
    recurrence_rule: task.recurrence_rule,
    sort_order: task.sort_order,
  })
}

describe('task list + TickTick sync integration', () => {
  let repos: Repositories
  let projectId: string

  beforeEach(() => {
    repos = openDatabase(':memory:')
    repos.settings.set('timezone', 'UTC')
    const project = repos.projects.create({ name: 'Work' })
    repos.projects.markSynced(project.id, PROJECT_REMOTE)
    projectId = project.id
  })

  afterEach(() => {
    if (repos?.db) closeDatabaseInstance(repos.db)
  })

  describe('schedule pull → list → push', () => {
    it('round-trips timed due-only with reminders (keeps clock on push)', () => {
      // 15:00 Europe/Minsk = 12:00Z
      pullRemoteTasks(repos, projectId, [
        {
          id: 'timed-1',
          projectId: PROJECT_REMOTE,
          title: 'Call',
          status: 0,
          dueDate: '2026-11-12T15:00:00+03:00',
          isAllDay: false,
          timeZone: TZ,
          reminders: ['TRIGGER:-PT15M', 'TRIGGER:PT0S'],
          tags: ['work'],
        },
      ])

      const listed = repos.tasks.list({ project_id: projectId })
      expect(listed).toHaveLength(1)
      const task = listed[0]!
      expect(task.title).toBe('Call')
      expect(task.due_date).toBe('2026-11-12T12:00:00.000Z')
      expect(task.start_date).toBeNull()
      expect(task.is_all_day).toBe(false)
      expect(isDateOnlySchedule(task, TZ)).toBe(false)
      expect(task.tags).toEqual(['work'])
      expect(repos.reminders.listForTask(task.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'before', offset_minutes: 15 }),
          expect.objectContaining({ kind: 'at_due', offset_minutes: 0 }),
        ]),
      )

      const payload = pushPayloadForLocal(repos, task.id)
      expect(payload.isAllDay).toBe(false)
      expect(payload.dueDate).toBe('2026-11-12T12:00:00.000Z')
      expect(payload.startDate).toBeNull()
      expect(payload.reminders).toEqual(
        expect.arrayContaining(['TRIGGER:-PT15M', 'TRIGGER:PT0S']),
      )
      expect(payload.tags).toEqual(['work'])
    })

    it('round-trips date-only (No time) as isAllDay without start', () => {
      // Midnight Minsk on Sep 21
      pullRemoteTasks(repos, projectId, [
        {
          id: 'date-only-1',
          projectId: PROJECT_REMOTE,
          title: 'No time task',
          status: 0,
          dueDate: '2026-09-20T21:00:00.000+0000',
          startDate: '2026-09-20T21:00:00.000+0000',
          isAllDay: true,
          timeZone: TZ,
        },
      ])

      const task = repos.tasks.list({ project_id: projectId })[0]!
      expect(task.is_all_day).toBe(false)
      expect(task.start_date).toBeNull()
      expect(task.due_date).toBe(normalizeDateOnlyInstant('2026-09-20T21:00:00.000+0000', TZ))
      expect(isDateOnlySchedule(task, TZ)).toBe(true)

      const payload = pushPayloadForLocal(repos, task.id)
      expect(payload.isAllDay).toBe(true)
      expect(payload.startDate).toBeNull()
      expect(payload.dueDate).toBe(task.due_date)
    })

    it('round-trips multi-day all-day events with start kept', () => {
      pullRemoteTasks(repos, projectId, [
        {
          id: 'all-day-1',
          projectId: PROJECT_REMOTE,
          title: 'Trip',
          status: 0,
          startDate: '2026-09-21T21:00:00.000+0000',
          dueDate: '2026-09-23T21:00:00.000+0000',
          isAllDay: true,
          timeZone: TZ,
        },
      ])

      const task = repos.tasks.list({ project_id: projectId })[0]!
      expect(task.is_all_day).toBe(true)
      expect(task.start_date).toBeTruthy()
      expect(task.due_date).toBeTruthy()
      expect(task.start_date).not.toBe(task.due_date)

      const payload = pushPayloadForLocal(repos, task.id)
      expect(payload.isAllDay).toBe(true)
      expect(payload.startDate).toBe(task.start_date)
      expect(payload.dueDate).toBe(task.due_date)
    })

    it('round-trips timed duration without collapsing start/due', () => {
      pullRemoteTasks(repos, projectId, [
        {
          id: 'dur-1',
          projectId: PROJECT_REMOTE,
          title: 'Meeting',
          status: 0,
          startDate: '2026-09-03T09:00:00+03:00',
          dueDate: '2026-09-03T10:00:00+03:00',
          isAllDay: false,
          timeZone: 'Europe/Moscow',
        },
      ])

      const task = repos.tasks.list({ project_id: projectId })[0]!
      expect(task.is_all_day).toBe(false)
      expect(task.start_date).toBe('2026-09-03T06:00:00.000Z')
      expect(task.due_date).toBe('2026-09-03T07:00:00.000Z')

      const payload = pushPayloadForLocal(repos, task.id)
      expect(payload.isAllDay).toBe(false)
      expect(payload.startDate).toBe(task.start_date)
      expect(payload.dueDate).toBe(task.due_date)
    })

    it('pushes locally created timed due-only without isAllDay', () => {
      const created = repos.tasks.create({
        title: 'Local timed',
        project_id: projectId,
        due_date: '2026-11-12T14:30:00.000Z',
        start_date: null,
        is_all_day: false,
        time_zone: TZ,
        reminders: [{ kind: 'before', offset_minutes: 30 }],
      })

      const payload = pushPayloadForLocal(repos, created.id)
      expect(payload.isAllDay).toBe(false)
      expect(payload.dueDate).toBe('2026-11-12T14:30:00.000Z')
      expect(payload.startDate).toBeNull()
      expect(payload.reminders).toEqual(['TRIGGER:-PT30M'])
    })
  })

  describe('smart lists after pull', () => {
    it('surfaces overdue and today; hides undated and tomorrow; hides subtask roots', () => {
      const now = Date.now()
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString()
      const today = new Date(now).toISOString()
      const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString()

      pullRemoteTasks(repos, projectId, [
        {
          id: 'overdue-1',
          projectId: PROJECT_REMOTE,
          title: 'Overdue',
          status: 0,
          dueDate: yesterday,
          isAllDay: false,
        },
        {
          id: 'today-1',
          projectId: PROJECT_REMOTE,
          title: 'Today',
          status: 0,
          dueDate: today,
          isAllDay: false,
        },
        {
          id: 'tomorrow-1',
          projectId: PROJECT_REMOTE,
          title: 'Tomorrow',
          status: 0,
          dueDate: tomorrow,
          isAllDay: false,
        },
        {
          id: 'undated-1',
          projectId: PROJECT_REMOTE,
          title: 'Someday',
          status: 0,
        },
        {
          id: 'parent-1',
          projectId: PROJECT_REMOTE,
          title: 'Parent',
          status: 0,
          dueDate: today,
          isAllDay: false,
        },
        {
          id: 'child-1',
          projectId: PROJECT_REMOTE,
          title: 'Child',
          status: 0,
          parentId: 'parent-1',
          dueDate: today,
          isAllDay: false,
        },
      ])

      const todayTitles = repos.tasks
        .list({ smart_list: 'today', sort: 'due_date' })
        .map((t) => t.title)
      expect(todayTitles[0]).toBe('Overdue')
      expect(todayTitles.sort()).toEqual(['Overdue', 'Parent', 'Today'].sort())
      expect(repos.tasks.list({ smart_list: 'overdue' }).map((t) => t.title)).toEqual(['Overdue'])
      expect(
        repos.tasks.list({ smart_list: 'tomorrow' }).map((t) => t.title),
      ).toEqual(['Tomorrow'])

      const projectRoots = repos.tasks.list({ project_id: projectId })
      expect(projectRoots.map((t) => t.title).sort()).toEqual(
        ['Overdue', 'Parent', 'Someday', 'Today', 'Tomorrow'].sort(),
      )
      expect(projectRoots.every((t) => t.parent_id == null)).toBe(true)

      const parent = projectRoots.find((t) => t.title === 'Parent')!
      expect(repos.tasks.list({ parent_id: parent.id }).map((t) => t.title)).toEqual(['Child'])
    })

    it('sorts due_date with timed before date-only on the same day', () => {
      // Same calendar day UTC: midnight date-only vs afternoon timed
      pullRemoteTasks(repos, projectId, [
        {
          id: 'timed-same',
          projectId: PROJECT_REMOTE,
          title: 'Timed 15:00',
          status: 0,
          dueDate: '2026-11-12T15:00:00.000Z',
          isAllDay: false,
          timeZone: 'UTC',
        },
        {
          id: 'date-same',
          projectId: PROJECT_REMOTE,
          title: 'Date only',
          status: 0,
          dueDate: '2026-11-12T00:00:00.000Z',
          isAllDay: true,
          timeZone: 'UTC',
        },
      ])

      const ordered = repos.tasks.list({
        project_id: projectId,
        sort: 'due_date',
      })
      expect(ordered.map((t) => t.title)).toEqual(['Timed 15:00', 'Date only'])
    })
  })

  describe('recurring + completion reconcile', () => {
    it('keeps active recurring master pending despite stale completedTime', () => {
      pullRemoteTasks(repos, projectId, [
        {
          id: 'recur-master',
          projectId: PROJECT_REMOTE,
          title: 'CGM Refinement',
          status: 0,
          dueDate: '2026-11-12T12:00:00+01:00',
          startDate: '2026-11-12T10:00:00+01:00',
          isAllDay: false,
          timeZone: 'Europe/Warsaw',
          completedTime: '2026-06-11T08:00:03.000+0000',
          repeatFlag: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TH',
          reminders: ['TRIGGER:-PT15M'],
        },
      ])

      const task = repos.tasks.getByRemoteId('recur-master')!
      expect(task.status).toBe('pending')
      expect(task.completed_at).toBeNull()
      expect(task.recurrence_rule?.frequency).toBe('weekly')
      expect(repos.tasks.list({ smart_list: 'today' }).some((t) => t.id === task.id)).toBe(true)

      const payload = pushPayloadForLocal(repos, task.id)
      expect(payload.isAllDay).toBe(false)
      expect(payload.repeatFlag).toContain('FREQ=WEEKLY')
      expect(payload.status).toBe(0)
    })

    it('imports completed-list rows that omit status via completedTime', () => {
      pullRemoteTasks(repos, projectId, [
        {
          id: 'done-omit-status',
          projectId: PROJECT_REMOTE,
          title: 'Finished occurrence',
          completedTime: '2026-11-05T09:05:58.000+0000',
          dueDate: '2026-11-05T12:00:00+01:00',
          isAllDay: false,
        },
      ])

      const task = repos.tasks.getByRemoteId('done-omit-status')!
      expect(task.status).toBe('completed')
      expect(task.completed_at).toBe('2026-11-05T09:05:58.000+0000')
      expect(
        repos.tasks.list({ smart_list: 'completed' }).map((t) => t.id),
      ).toContain(task.id)
    })

    it('remote completion wins over dirty local edits; vanish removes deleted', () => {
      const dirty = repos.tasks.create({
        title: 'Local edit',
        project_id: projectId,
        due_date: new Date().toISOString(),
      })
      repos.tasks.markSynced(dirty.id, 'dirty-remote')
      repos.tasks.update(dirty.id, { title: 'Still editing' })
      expect(repos.tasks.getById(dirty.id)?.sync_status).toBe('pending_update')

      const { upserted, skippedDirty } = pullRemoteTasks(repos, projectId, [
        {
          id: 'dirty-remote',
          projectId: PROJECT_REMOTE,
          title: 'Completed on TickTick',
          status: 2,
          completedTime: '2026-11-12T10:00:00.000Z',
        },
      ])
      expect(upserted).toBe(1)
      expect(skippedDirty).toBe(0)
      expect(repos.tasks.getById(dirty.id)?.status).toBe('completed')
      expect(repos.tasks.getById(dirty.id)?.sync_status).toBe('synced')

      const gone = repos.tasks.create({ title: 'Deleted remotely', project_id: projectId })
      repos.tasks.markSynced(gone.id, 'gone-remote')
      const pending = repos.tasks.listSyncedPendingWithRemote(projectId)
      const missing = pending.filter((row) => row.remote_id === 'gone-remote')
      expect(missing).toHaveLength(1)

      const action = classifyVanishedTask({
        localStatus: 'pending',
        inCompletedPull: false,
      })
      expect(action).toBe('remove')
      repos.tasks.markRemovedFromRemote(gone.id)
      expect(repos.tasks.getById(gone.id)).toBeNull()
      expect(repos.tasks.listPendingSync()).toHaveLength(0)
    })

    it('force-completes vanished tasks found in completed pull', () => {
      const task = repos.tasks.create({
        title: 'Will complete remotely',
        project_id: projectId,
        due_date: new Date().toISOString(),
      })
      repos.tasks.markSynced(task.id, 'vanish-complete')

      const action = classifyVanishedTask({
        localStatus: 'pending',
        inCompletedPull: true,
      })
      expect(action).toBe('force_complete')
      repos.tasks.applyRemoteCompletion(task.id, '2026-11-12T11:00:00.000Z')
      expect(repos.tasks.getById(task.id)?.status).toBe('completed')
      expect(
        repos.tasks.list({ smart_list: 'today', include_completed: true }).some((t) => t.id === task.id),
      ).toBe(true)
    })
  })

  describe('sections + parents on pull', () => {
    it('assigns column sections and nests children under parents', () => {
      upsertRemoteColumns(repos, projectId, [
        { id: 'col-todo', projectId: PROJECT_REMOTE, name: 'Todo', sortOrder: 0 },
        { id: 'col-doing', projectId: PROJECT_REMOTE, name: 'Doing', sortOrder: 1 },
      ])

      pullRemoteTasks(repos, projectId, [
        {
          id: 'child-first',
          projectId: PROJECT_REMOTE,
          title: 'Child arrives first',
          status: 0,
          parentId: 'parent-later',
          columnId: 'col-doing',
        },
        {
          id: 'parent-later',
          projectId: PROJECT_REMOTE,
          title: 'Parent',
          status: 0,
          columnId: 'col-doing',
        },
        {
          id: 'todo-root',
          projectId: PROJECT_REMOTE,
          title: 'Todo root',
          status: 0,
          columnId: 'col-todo',
        },
      ])

      const roots = repos.tasks.list({ project_id: projectId })
      expect(roots.map((t) => t.title).sort()).toEqual(['Parent', 'Todo root'])
      expect(roots.find((t) => t.title === 'Parent')?.section_name).toBe('Doing')
      expect(roots.find((t) => t.title === 'Todo root')?.section_name).toBe('Todo')

      const parent = roots.find((t) => t.title === 'Parent')!
      const children = repos.tasks.list({ parent_id: parent.id })
      expect(children).toHaveLength(1)
      expect(children[0]!.title).toBe('Child arrives first')
      expect(children[0]!.section_name).toBe('Doing')

      const payload = pushPayloadForLocal(repos, parent.id)
      expect(payload.columnId).toBe('col-doing')
      expect(payload.parentId).toBeUndefined()

      const childPayload = pushPayloadForLocal(repos, children[0]!.id)
      expect(childPayload.parentId).toBe('parent-later')
      expect(childPayload.columnId).toBe('col-doing')
    })

    it('column reconcile drops missing section and moves tasks to Not Sectioned', () => {
      // Default must be a synced remote column so reconcileMissingRemote can retarget it.
      upsertRemoteColumns(repos, projectId, [
        { id: 'col-ns', projectId: PROJECT_REMOTE, name: 'Not Sectioned', sortOrder: -1 },
        { id: 'col-todo', projectId: PROJECT_REMOTE, name: 'Todo', sortOrder: 0 },
        { id: 'col-doing', projectId: PROJECT_REMOTE, name: 'Doing', sortOrder: 1 },
      ])

      pullRemoteTasks(repos, projectId, [
        {
          id: 'in-doing',
          projectId: PROJECT_REMOTE,
          title: 'Was Doing',
          status: 0,
          columnId: 'col-doing',
        },
        {
          id: 'in-todo',
          projectId: PROJECT_REMOTE,
          title: 'Stays Todo',
          status: 0,
          columnId: 'col-todo',
        },
      ])

      const removed = repos.sections.reconcileMissingRemote(
        projectId,
        new Set(['col-ns', 'col-todo']),
      )
      expect(removed).toBe(1)

      const sections = repos.sections.listByProject(projectId)
      expect(sections.some((s) => s.remote_id === 'col-doing')).toBe(false)
      expect(sections.some((s) => s.is_default)).toBe(true)

      const roots = repos.tasks.list({ project_id: projectId })
      const wasDoing = roots.find((t) => t.title === 'Was Doing')!
      const staysTodo = roots.find((t) => t.title === 'Stays Todo')!
      expect(wasDoing.section_name).toBe('Not Sectioned')
      expect(staysTodo.section_name).toBe('Todo')

      const groups = groupTasksBySection(roots, sections)
      expect(groups.find((g) => g.label === 'Not Sectioned')?.tasks.map((t) => t.title)).toEqual([
        'Was Doing',
      ])
      expect(groups.find((g) => g.label === 'Todo')?.tasks.map((t) => t.title)).toEqual([
        'Stays Todo',
      ])
      expect(groups.some((g) => g.label === 'Doing')).toBe(false)
    })

    it('pushes default Not Sectioned with columnId null', () => {
      const doing = repos.sections.create({ project_id: projectId, name: 'Doing' })
      const def = repos.sections.getDefaultForProject(projectId)!
      expect(def.remote_id).toBeNull()

      const inDefault = repos.tasks.create({
        title: 'Unsectioned',
        project_id: projectId,
        section_id: def.id,
      })
      const inDoing = repos.tasks.create({
        title: 'In Doing',
        project_id: projectId,
        section_id: doing.id,
      })
      repos.tasks.markSynced(inDefault.id, 'local-ns')
      repos.tasks.markSynced(inDoing.id, 'local-doing')
      // Named section needs a remote id for push mapping
      repos.db
        .prepare(`UPDATE project_sections SET remote_id = ?, sync_status = 'synced' WHERE id = ?`)
        .run('col-doing', doing.id)

      expect(pushPayloadForLocal(repos, inDefault.id).columnId).toBeNull()
      expect(pushPayloadForLocal(repos, inDoing.id).columnId).toBe('col-doing')
    })
  })

  describe('recurring complete → list shape', () => {
    it('local complete moves occurrence to completed and next pending into project/tomorrow', () => {
      const due = new Date()
      due.setUTCHours(12, 0, 0, 0)
      const dueIso = due.toISOString()

      const task = repos.tasks.create({
        title: 'Daily chore',
        project_id: projectId,
        due_date: dueIso,
        recurrence_rule: defaultRecurrence('daily'),
      })

      repos.tasks.complete(task.id)

      expect(repos.tasks.getById(task.id)?.status).toBe('completed')
      expect(
        repos.tasks.list({ smart_list: 'completed' }).some((t) => t.id === task.id),
      ).toBe(true)

      const next = repos.tasks.list({ project_id: projectId, status: 'pending' })[0]
      expect(next).toBeDefined()
      expect(next!.title).toBe('Daily chore')
      expect(next!.id).not.toBe(task.id)
      expect(next!.due_date).toBe(addDays(parseISO(dueIso), 1).toISOString())

      expect(
        repos.tasks.list({ smart_list: 'tomorrow' }).some((t) => t.id === next!.id),
      ).toBe(true)
      expect(
        repos.tasks
          .list({ project_id: projectId, include_completed: true })
          .map((t) => t.id)
          .sort(),
      ).toEqual([task.id, next!.id].sort())
    })
  })
})
