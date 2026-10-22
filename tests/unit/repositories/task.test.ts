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
})
