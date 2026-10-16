import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { Repositories } from '../../../electron/main/db/openDatabase'
import { closeDatabaseInstance, openDatabase } from '../../../electron/main/db/openDatabase'
import { migrations, runMigrations } from '../../../electron/main/db/migrations'

describe('TagRepository', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    closeDatabaseInstance(repos.db)
  })

  it('creates unique tags', () => {
    const first = repos.tags.create({ name: 'urgent' })
    const second = repos.tags.create({ name: 'urgent' })

    expect(first.id).toBe(second.id)
    expect(repos.tags.list()).toHaveLength(1)
  })

  it('links tags to tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({ title: 'Task', project_id: inbox.id })

    repos.tags.setTaskTags(task.id, ['home', 'work'])
    expect(repos.tags.getTagsForTask(task.id).sort()).toEqual(['home', 'work'])
  })

  it('bulkUpdate add_tags persists for multiple tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const a = repos.tasks.create({ title: 'A', project_id: inbox.id })
    const b = repos.tasks.create({ title: 'B', project_id: inbox.id, tags: ['old'] })
    repos.tags.create({ name: 'work' })

    repos.tasks.bulkUpdate([a.id, b.id], { add_tags: ['work'] })

    expect(repos.tags.getTagsForTask(a.id)).toEqual(['work'])
    expect(repos.tags.getTagsForTask(b.id).sort()).toEqual(['old', 'work'])

    const listed = repos.tasks.list({ project_id: inbox.id })
    expect(listed.find((t) => t.id === a.id)?.tags).toEqual(['work'])
    expect(listed.find((t) => t.id === b.id)?.tags.sort()).toEqual(['old', 'work'])
  })
})

describe('SettingsRepository', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    closeDatabaseInstance(repos.db)
  })

  it('reads and writes settings', () => {
    repos.settings.set('theme', 'dark')
    expect(repos.settings.get<string>('theme')).toBe('dark')
    expect(repos.settings.getTimezoneSetting()).toBe('system')
    expect(repos.settings.getTimezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })
})

describe('runMigrations', () => {
  it('applies migrations idempotently', () => {
    const repos = openDatabase(':memory:')
    const countVersions = () =>
      (
        repos.db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as {
          version: number
        }[]
      ).map((row) => row.version)

    expect(countVersions()).toEqual(migrations.map((m) => m.version))

    runMigrations(repos.db)
    expect(countVersions()).toEqual(migrations.map((m) => m.version))

    closeDatabaseInstance(repos.db)
  })
})
