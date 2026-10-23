import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabaseInstance, openDatabase, type Repositories } from '../../../electron/main/db/openDatabase'

describe('ProjectSectionRepository', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    closeDatabaseInstance(repos.db)
  })

  it('creates sections and assigns tasks', () => {
    const inbox = repos.projects.ensureInbox()
    const section = repos.sections.create({ project_id: inbox.id, name: 'Doing' })
    expect(section.name).toBe('Doing')
    expect(section.sync_status).toBe('pending_create')

    const task = repos.tasks.create({
      title: 'Focus',
      project_id: inbox.id,
      section_id: section.id,
    })
    expect(task.section_id).toBe(section.id)

    const listed = repos.tasks.list({ project_id: inbox.id })
    expect(listed[0]?.section_id).toBe(section.id)
    expect(listed[0]?.section_name).toBe('Doing')
  })

  it('auto-creates Not Sectioned when first section is added', () => {
    const inbox = repos.projects.ensureInbox()
    repos.sections.create({ project_id: inbox.id, name: 'Doing' })
    const sections = repos.sections.listByProject(inbox.id)
    expect(sections.some((s) => s.is_default && s.name === 'Not Sectioned')).toBe(true)
  })

  it('assigns new tasks without section_id to Not Sectioned', () => {
    const inbox = repos.projects.ensureInbox()
    repos.sections.create({ project_id: inbox.id, name: 'Doing' })
    const def = repos.sections.getDefaultForProject(inbox.id)!
    const task = repos.tasks.create({ title: 'Loose', project_id: inbox.id })
    expect(task.section_id).toBe(def.id)
  })

  it('creates Not Sectioned on task add when list has sections but no default', () => {
    const inbox = repos.projects.ensureInbox()
    // Remote-style section without going through create() (which auto-adds default)
    repos.sections.upsertFromRemote({
      remote_id: 'col-doing',
      project_id: inbox.id,
      name: 'Doing',
      sort_order: 0,
      remote_updated_at: null,
    })
    expect(repos.sections.getDefaultForProject(inbox.id)).toBeNull()

    const task = repos.tasks.create({ title: 'Appears', project_id: inbox.id })
    const def = repos.sections.getDefaultForProject(inbox.id)
    expect(def?.name).toBe('Not Sectioned')
    expect(task.section_id).toBe(def!.id)
  })

  it('listByProject heals missing Not Sectioned', () => {
    const inbox = repos.projects.ensureInbox()
    repos.sections.upsertFromRemote({
      remote_id: 'col-a',
      project_id: inbox.id,
      name: 'A',
      sort_order: 0,
      remote_updated_at: null,
    })
    expect(repos.sections.getDefaultForProject(inbox.id)).toBeNull()
    const listed = repos.sections.listByProject(inbox.id)
    expect(listed.some((s) => s.is_default && s.name === 'Not Sectioned')).toBe(true)
  })

  it('forbids deleting the default section', () => {
    const inbox = repos.projects.ensureInbox()
    repos.sections.create({ project_id: inbox.id, name: 'Doing' })
    const def = repos.sections.getDefaultForProject(inbox.id)!
    expect(() => repos.sections.softDelete(def.id)).toThrow(/Cannot delete/)
  })

  it('upserts from remote and reconciles missing columns', () => {
    const inbox = repos.projects.ensureInbox()
    const kept = repos.sections.upsertFromRemote({
      remote_id: 'col-1',
      project_id: inbox.id,
      name: 'Keep',
      sort_order: 0,
      remote_updated_at: null,
    })
    repos.sections.upsertFromRemote({
      remote_id: 'col-gone',
      project_id: inbox.id,
      name: 'Gone',
      sort_order: 1,
      remote_updated_at: null,
    })
    repos.sections.ensureDefaultSection(inbox.id)

    repos.sections.reconcileMissingRemote(inbox.id, new Set(['col-1']))
    const remaining = repos.sections.listByProject(inbox.id)
    expect(remaining.map((s) => s.id)).toContain(kept.id)
    expect(remaining.some((s) => s.remote_id === 'col-gone')).toBe(false)
    expect(remaining.some((s) => s.is_default)).toBe(true)
  })

  it('soft-deletes section and moves tasks to Not Sectioned', () => {
    const inbox = repos.projects.ensureInbox()
    const section = repos.sections.create({ project_id: inbox.id, name: 'Temp' })
    const def = repos.sections.getDefaultForProject(inbox.id)!
    const task = repos.tasks.create({
      title: 'Item',
      project_id: inbox.id,
      section_id: section.id,
    })
    repos.tasks.markSynced(task.id, 'remote-task')
    repos.sections.softDelete(section.id)

    expect(repos.sections.getById(section.id)).toBeNull()
    expect(repos.tasks.getById(task.id)?.section_id).toBe(def.id)
    expect(repos.tasks.getById(task.id)?.sync_status).toBe('pending_update')
  })
})
