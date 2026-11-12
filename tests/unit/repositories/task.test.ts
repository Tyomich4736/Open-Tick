import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { addDays, formatISO, parseISO } from 'date-fns'
import type { Repositories } from '../../../electron/main/db/openDatabase'
import { closeDatabaseInstance, openDatabase } from '../../../electron/main/db/openDatabase'
import { defaultRecurrence } from '../../../shared/recurrence'

describe('TaskRepository', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
    repos.settings.set('timezone', 'UTC')
  })

  afterEach(() => {
    if (repos?.db) closeDatabaseInstance(repos.db)
  })

  it('lists pending sync summary for unpushed tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const created = repos.tasks.create({ title: 'Local only', project_id: inbox.id })
    const updated = repos.tasks.create({ title: 'Will edit', project_id: inbox.id })
    repos.tasks.markSynced(updated.id, 'remote-1')
    repos.tasks.update(updated.id, { title: 'Edited locally' })

    const pending = repos.tasks.listPendingSyncSummary()
    expect(pending.map((t) => t.id).sort()).toEqual([created.id, updated.id].sort())
    expect(pending.find((t) => t.id === created.id)?.sync_status).toBe('pending_create')
    expect(pending.find((t) => t.id === updated.id)?.sync_status).toBe('pending_update')
    expect(pending.find((t) => t.id === created.id)?.project_is_inbox).toBe(true)
  })

  it('creates, updates, completes, and deletes tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({ title: 'Buy milk', project_id: inbox.id })

    expect(task.title).toBe('Buy milk')
    expect(task.sync_status).toBe('pending_create')

    const updated = repos.tasks.update(task.id, { title: 'Buy oat milk', priority: 3 })
    expect(updated.title).toBe('Buy oat milk')
    expect(updated.priority).toBe(3)

    const completed = repos.tasks.complete(task.id)
    expect(completed.status).toBe('completed')
    expect(completed.completed_at).not.toBeNull()

    repos.tasks.softDelete(task.id)
    expect(repos.tasks.getById(task.id)).toBeNull()
  })

  it('creates subtasks in the same project', () => {
    const inbox = repos.projects.ensureInbox()
    const parent = repos.tasks.create({ title: 'Parent', project_id: inbox.id })
    const subtask = repos.tasks.create({
      title: 'Child',
      project_id: inbox.id,
      parent_id: parent.id,
    })

    expect(subtask.parent_id).toBe(parent.id)
    const items = repos.tasks.list({ parent_id: parent.id })
    expect(items).toHaveLength(1)
  })

  it('filters inbox tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const work = repos.projects.create({ name: 'Work' })

    repos.tasks.create({ title: 'Inbox task', project_id: inbox.id })
    repos.tasks.create({ title: 'Work task', project_id: work.id })

    const inboxTasks = repos.tasks.list({ smart_list: 'inbox' })
    expect(inboxTasks).toHaveLength(1)
    expect(inboxTasks[0].title).toBe('Inbox task')
  })

  it('assigns tags to tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({
      title: 'Tagged task',
      project_id: inbox.id,
      tags: ['urgent', 'home'],
    })

    const items = repos.tasks.list({ project_id: inbox.id })
    const listed = items.find((item) => item.id === task.id)
    expect(listed?.tags.sort()).toEqual(['home', 'urgent'])
  })

  it('filters today tasks by due date and includes overdue', () => {
    const inbox = repos.projects.ensureInbox()
    const today = formatISO(new Date())
    const yesterday = formatISO(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const tomorrow = formatISO(new Date(Date.now() + 24 * 60 * 60 * 1000))

    repos.tasks.create({ title: 'Due today', project_id: inbox.id, due_date: today })
    repos.tasks.create({ title: 'Late', project_id: inbox.id, due_date: yesterday })
    repos.tasks.create({ title: 'No due', project_id: inbox.id })
    repos.tasks.create({ title: 'Soon', project_id: inbox.id, due_date: tomorrow })

    const todayTasks = repos.tasks.list({ smart_list: 'today', sort: 'due_date' })
    expect(todayTasks.map((t) => t.title)).toEqual(['Late', 'Due today'])
  })

  it('today show-completed keeps overdue pending but not old completed', () => {
    const inbox = repos.projects.ensureInbox()
    const today = formatISO(new Date())
    const yesterday = formatISO(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const lastWeek = formatISO(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

    repos.tasks.create({ title: 'Due today', project_id: inbox.id, due_date: today })
    repos.tasks.create({
      title: 'Overdue open',
      project_id: inbox.id,
      due_date: yesterday,
    })
    const overdueDone = repos.tasks.create({
      title: 'Old overdue done',
      project_id: inbox.id,
      due_date: lastWeek,
    })
    repos.tasks.complete(overdueDone.id)
    // Completed last week (not today) — must not appear in Today when show-completed is on.
    repos.db
      .prepare(`UPDATE tasks SET completed_at = ? WHERE id = ?`)
      .run(lastWeek, overdueDone.id)

    const doneToday = repos.tasks.create({
      title: 'Done today',
      project_id: inbox.id,
      due_date: yesterday,
    })
    repos.tasks.complete(doneToday.id)

    const withCompleted = repos.tasks.list({
      smart_list: 'today',
      include_completed: true,
      sort: 'due_date',
    })
    const titles = withCompleted.map((t) => t.title).sort()
    expect(titles).toContain('Due today')
    expect(titles).toContain('Overdue open')
    expect(titles).toContain('Done today')
    expect(titles).not.toContain('Old overdue done')
  })

  it('filters overdue tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const yesterday = formatISO(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const tomorrow = formatISO(new Date(Date.now() + 24 * 60 * 60 * 1000))

    repos.tasks.create({ title: 'Late', project_id: inbox.id, due_date: yesterday })
    repos.tasks.create({ title: 'Soon', project_id: inbox.id, due_date: tomorrow })

    const overdue = repos.tasks.list({ smart_list: 'overdue' })
    expect(overdue.map((t) => t.title)).toEqual(['Late'])
  })

  it('sorts by title, priority, and due date (overdue first)', () => {
    const inbox = repos.projects.ensureInbox()
    const yesterday = formatISO(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const tomorrow = formatISO(new Date(Date.now() + 24 * 60 * 60 * 1000))

    repos.tasks.create({ title: 'Bravo', project_id: inbox.id, priority: 1, due_date: tomorrow })
    repos.tasks.create({ title: 'Alpha', project_id: inbox.id, priority: 5, due_date: yesterday })

    const byTitle = repos.tasks.list({ project_id: inbox.id, sort: 'title' })
    expect(byTitle.map((t) => t.title)).toEqual(['Alpha', 'Bravo'])

    const byPriority = repos.tasks.list({ project_id: inbox.id, sort: 'priority' })
    expect(byPriority.map((t) => t.title)).toEqual(['Alpha', 'Bravo'])

    const byDue = repos.tasks.list({ project_id: inbox.id, sort: 'due_date' })
    expect(byDue.map((t) => t.title)).toEqual(['Alpha', 'Bravo'])
  })

  it('sorts due_date with timed before date-only on the same day', () => {
    const inbox = repos.projects.ensureInbox()
    // Align with settings timezone (UTC): midnight = date-only, then timed clocks.
    repos.tasks.create({
      title: 'Afternoon',
      project_id: inbox.id,
      due_date: '2026-11-12T15:00:00.000Z',
      is_all_day: false,
    })
    repos.tasks.create({
      title: 'No time',
      project_id: inbox.id,
      due_date: '2026-11-12T00:00:00.000Z',
      is_all_day: false,
    })
    repos.tasks.create({
      title: 'Morning',
      project_id: inbox.id,
      due_date: '2026-11-12T09:00:00.000Z',
      is_all_day: false,
    })

    const byDue = repos.tasks.list({ project_id: inbox.id, sort: 'due_date' })
    expect(byDue.map((t) => t.title)).toEqual(['Morning', 'Afternoon', 'No time'])
  })

  it('hides completed when include_completed is false', () => {
    const work = repos.projects.create({ name: 'Work' })
    const open = repos.tasks.create({ title: 'Open', project_id: work.id })
    const done = repos.tasks.create({ title: 'Done', project_id: work.id })
    repos.tasks.complete(done.id)

    const hidden = repos.tasks.list({ project_id: work.id, include_completed: false })
    expect(hidden.map((t) => t.title)).toEqual(['Open'])

    const shown = repos.tasks.list({ project_id: work.id, include_completed: true })
    expect(shown.map((t) => t.id).sort()).toEqual([open.id, done.id].sort())
  })

  it('lists completed by completed_at desc', () => {
    const inbox = repos.projects.ensureInbox()
    const first = repos.tasks.create({ title: 'First', project_id: inbox.id })
    const second = repos.tasks.create({ title: 'Second', project_id: inbox.id })
    repos.tasks.complete(first.id)
    repos.tasks.complete(second.id)
    // Distinct timestamps — complete() can share the same millisecond.
    repos.db
      .prepare(`UPDATE tasks SET completed_at = ? WHERE id = ?`)
      .run('2026-01-01T10:00:00.000Z', first.id)
    repos.db
      .prepare(`UPDATE tasks SET completed_at = ? WHERE id = ?`)
      .run('2026-01-01T11:00:00.000Z', second.id)

    const completed = repos.tasks.list({ smart_list: 'completed' })
    expect(completed[0].title).toBe('Second')
    expect(completed[1].title).toBe('First')
  })

  it('stores and replaces reminders (max 5)', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({
      title: 'Remind me',
      project_id: inbox.id,
      reminders: [
        { kind: 'at_due', offset_minutes: 0 },
        { kind: 'before', offset_minutes: 15 },
        { kind: 'before', offset_minutes: 60 },
      ],
    })

    expect(repos.reminders.listForTask(task.id)).toHaveLength(3)

    repos.tasks.update(task.id, {
      reminders: [
        { kind: 'before', offset_minutes: 5 },
        { kind: 'before', offset_minutes: 15 },
        { kind: 'before', offset_minutes: 30 },
        { kind: 'before', offset_minutes: 60 },
        { kind: 'before', offset_minutes: 1440 },
      ],
    })
    expect(repos.reminders.listForTask(task.id)).toHaveLength(5)

    expect(() =>
      repos.reminders.replaceForTask(task.id, [
        { kind: 'before', offset_minutes: 1 },
        { kind: 'before', offset_minutes: 2 },
        { kind: 'before', offset_minutes: 3 },
        { kind: 'before', offset_minutes: 4 },
        { kind: 'before', offset_minutes: 5 },
        { kind: 'before', offset_minutes: 6 },
      ]),
    ).toThrow(/at most 5/)
  })

  it('spawns next occurrence when completing a recurring task', () => {
    const inbox = repos.projects.ensureInbox()
    const due = '2026-08-28T12:00:00.000Z'
    const dueDate = parseISO(due)
    const task = repos.tasks.create({
      title: 'Weekly standup',
      project_id: inbox.id,
      due_date: due,
      // Match advanceWeekly's local getDay() so the next due is stable across TZ.
      recurrence_rule: { ...defaultRecurrence('weekly'), weekdays: [dueDate.getDay()] },
      reminders: [{ kind: 'before', offset_minutes: 15 }],
      tags: ['work'],
    })

    repos.tasks.complete(task.id)

    const pending = repos.tasks.list({ project_id: inbox.id, status: 'pending' })
    expect(pending).toHaveLength(1)
    expect(pending[0].title).toBe('Weekly standup')

    const next = repos.tasks.getById(pending[0].id)!
    expect(next.recurrence_rule).not.toBeNull()
    expect(next.recurrence_parent_id).toBe(task.id)
    expect(next.due_date).toBe(addDays(dueDate, 7).toISOString())
    expect(repos.reminders.listForTask(next.id)).toHaveLength(1)
    expect(repos.tags.getTagsForTask(next.id)).toEqual(['work'])
  })

  it('does not spawn again when complete is called twice', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({
      title: 'Daily',
      project_id: inbox.id,
      due_date: formatISO(new Date('2026-08-28T12:00:00.000Z')),
      recurrence_rule: defaultRecurrence('daily'),
    })

    repos.tasks.complete(task.id)
    repos.tasks.complete(task.id)

    const pending = repos.tasks.list({ project_id: inbox.id, status: 'pending' })
    expect(pending).toHaveLength(1)
  })

  it('removes spawned occurrence when uncompleting a recurring task', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({
      title: 'Daily',
      project_id: inbox.id,
      due_date: formatISO(new Date('2026-08-28T12:00:00.000Z')),
      recurrence_rule: defaultRecurrence('daily'),
    })

    repos.tasks.complete(task.id)
    expect(repos.tasks.list({ project_id: inbox.id, status: 'pending' })).toHaveLength(1)

    repos.tasks.uncomplete(task.id)

    const pending = repos.tasks.list({ project_id: inbox.id, status: 'pending' })
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(task.id)
    expect(pending[0].status).toBe('pending')
  })

  it('edit this occurrence clears recurrence on the row', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({
      title: 'Series',
      project_id: inbox.id,
      due_date: formatISO(new Date()),
      recurrence_rule: defaultRecurrence('daily'),
    })

    const updated = repos.tasks.update(task.id, {
      title: 'Exception',
      recurrence_edit_scope: 'this',
    })

    expect(updated.title).toBe('Exception')
    expect(updated.recurrence_rule).toBeNull()
    expect(updated.recurrence_parent_id).toBe(task.id)
  })

  it('bulkComplete completes and uncompletes unique ids; skips missing', () => {
    const inbox = repos.projects.ensureInbox()
    const a = repos.tasks.create({ title: 'A', project_id: inbox.id })
    const b = repos.tasks.create({ title: 'B', project_id: inbox.id })
    const c = repos.tasks.create({ title: 'C', project_id: inbox.id })

    repos.tasks.bulkComplete([a.id, b.id, a.id, 'missing-id'], true)
    expect(repos.tasks.getById(a.id)?.status).toBe('completed')
    expect(repos.tasks.getById(b.id)?.status).toBe('completed')
    expect(repos.tasks.getById(c.id)?.status).toBe('pending')

    repos.tasks.bulkComplete([a.id, b.id], false)
    expect(repos.tasks.getById(a.id)?.status).toBe('pending')
    expect(repos.tasks.getById(b.id)?.status).toBe('pending')
  })

  it('bulkUpdate sets priority, due, project, and remove_tags; skips missing ids', () => {
    const inbox = repos.projects.ensureInbox()
    const work = repos.projects.create({ name: 'Work' })
    const a = repos.tasks.create({
      title: 'A',
      project_id: inbox.id,
      tags: ['keep', 'drop'],
    })
    const b = repos.tasks.create({ title: 'B', project_id: inbox.id, tags: ['drop'] })
    const due = '2026-11-15T12:00:00.000Z'

    repos.tasks.bulkUpdate([a.id, b.id, a.id, 'missing-id'], {
      priority: 5,
      due_date: due,
      project_id: work.id,
      remove_tags: ['drop'],
    })

    const a2 = repos.tasks.getById(a.id)!
    const b2 = repos.tasks.getById(b.id)!
    expect(a2.priority).toBe(5)
    expect(a2.due_date).toBe(due)
    expect(a2.project_id).toBe(work.id)
    expect(repos.tags.getTagsForTask(a.id)).toEqual(['keep'])
    expect(b2.priority).toBe(5)
    expect(b2.project_id).toBe(work.id)
    expect(repos.tags.getTagsForTask(b.id)).toEqual([])
  })

  it('bulkDelete soft-deletes unique ids and ignores missing', () => {
    const inbox = repos.projects.ensureInbox()
    const a = repos.tasks.create({ title: 'A', project_id: inbox.id })
    const b = repos.tasks.create({ title: 'B', project_id: inbox.id })

    repos.tasks.bulkDelete([a.id, a.id, 'missing-id'])
    expect(repos.tasks.getById(a.id)).toBeNull()
    expect(repos.tasks.getById(b.id)?.title).toBe('B')
    expect(repos.tasks.list({ project_id: inbox.id }).map((t) => t.id)).toEqual([b.id])
  })

  it('spawns next occurrence with same section_id and parent_id', () => {
    const project = repos.projects.create({ name: 'Work' })
    const doing = repos.sections.create({ project_id: project.id, name: 'Doing' })
    const parent = repos.tasks.create({
      title: 'Parent',
      project_id: project.id,
      section_id: doing.id,
    })
    const due = '2026-08-28T12:00:00.000Z'
    const task = repos.tasks.create({
      title: 'Daily under parent',
      project_id: project.id,
      parent_id: parent.id,
      section_id: doing.id,
      due_date: due,
      recurrence_rule: defaultRecurrence('daily'),
    })

    repos.tasks.complete(task.id)

    const nextList = repos.tasks.list({ parent_id: parent.id, status: 'pending' })
    expect(nextList).toHaveLength(1)
    expect(nextList[0]!.id).not.toBe(task.id)
    const next = repos.tasks.getById(nextList[0]!.id)!
    expect(next.parent_id).toBe(parent.id)
    expect(next.section_id).toBe(doing.id)
    expect(repos.tasks.getById(task.id)?.status).toBe('completed')
  })

  it('applyRemoteCompletion on recurring does not spawn a next occurrence', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({
      title: 'Remote daily',
      project_id: inbox.id,
      due_date: '2026-08-28T12:00:00.000Z',
      recurrence_rule: defaultRecurrence('daily'),
    })
    repos.tasks.markSynced(task.id, 'remote-daily')

    repos.tasks.applyRemoteCompletion(task.id, '2026-08-28T13:00:00.000Z')

    expect(repos.tasks.getById(task.id)?.status).toBe('completed')
    expect(repos.tasks.list({ project_id: inbox.id, status: 'pending' })).toHaveLength(0)
    expect(repos.tasks.list({ project_id: inbox.id, include_completed: true })).toHaveLength(1)
  })

  it('filters next 7 days smart list (today through +7, not overdue or +8)', () => {
    const inbox = repos.projects.ensureInbox()
    const now = Date.now()
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString()
    const today = new Date(now).toISOString()
    const inThree = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString()
    const inSeven = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString()
    const inEight = new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString()

    repos.tasks.create({ title: 'Overdue', project_id: inbox.id, due_date: yesterday })
    repos.tasks.create({ title: 'Today', project_id: inbox.id, due_date: today })
    repos.tasks.create({ title: 'In 3', project_id: inbox.id, due_date: inThree })
    repos.tasks.create({ title: 'In 7', project_id: inbox.id, due_date: inSeven })
    repos.tasks.create({ title: 'In 8', project_id: inbox.id, due_date: inEight })
    repos.tasks.create({ title: 'Undated', project_id: inbox.id })

    const week = repos.tasks.list({ smart_list: 'week' }).map((t) => t.title).sort()
    expect(week).toEqual(['In 3', 'In 7', 'Today'])
  })
})
