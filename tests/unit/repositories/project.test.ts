import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { Repositories } from '../../../electron/main/db/openDatabase'
import { closeDatabaseInstance, openDatabase } from '../../../electron/main/db/openDatabase'

describe('ProjectRepository', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    closeDatabaseInstance(repos.db)
  })

  it('creates and lists projects', () => {
    const created = repos.projects.create({ name: 'Work', color: '#4772FA' })
    const list = repos.projects.list()

    expect(list.some((p) => p.id === created.id)).toBe(true)
    expect(list.some((p) => p.is_inbox)).toBe(true)
  })

  it('updates a project', () => {
    const project = repos.projects.create({ name: 'Work' })
    const updated = repos.projects.update(project.id, { name: 'Work Updated' })

    expect(updated.name).toBe('Work Updated')
    expect(updated.sync_status).toBe('pending_create')
  })

  it('soft deletes a project', () => {
    const project = repos.projects.create({ name: 'Temp' })
    repos.projects.softDelete(project.id)

    expect(repos.projects.getById(project.id)).toBeNull()
  })

  it('hard-deletes a never-synced list with sections and tasks (FK-safe)', () => {
    const project = repos.projects.create({ name: 'Sectioning test' })
    const section = repos.sections.create({ project_id: project.id, name: 'A' })
    const parent = repos.tasks.create({ project_id: project.id, title: 'Parent', section_id: section.id })
    repos.tasks.create({
      project_id: project.id,
      title: 'Child',
      parent_id: parent.id,
      section_id: section.id,
    })

    expect(() => repos.projects.softDelete(project.id)).not.toThrow()
    expect(repos.projects.getById(project.id)).toBeNull()
    expect(repos.sections.listByProject(project.id)).toEqual([])
    expect(repos.tasks.list({ project_id: project.id, parent_id: null })).toEqual([])
  })

  it('cascade hard-deletes a synced pending_delete list without FK errors', () => {
    const project = repos.projects.create({ name: 'Remote list' })
    // Simulate synced remote list
    repos.db
      .prepare(`UPDATE projects SET remote_id = ?, sync_status = 'synced' WHERE id = ?`)
      .run('remote-proj', project.id)
    const section = repos.sections.create({ project_id: project.id, name: 'Col' })
    repos.db
      .prepare(`UPDATE project_sections SET remote_id = ?, sync_status = 'synced' WHERE id = ?`)
      .run('remote-col', section.id)
    repos.tasks.create({ project_id: project.id, title: 'T', section_id: section.id })

    repos.projects.softDelete(project.id)
    expect(repos.projects.getById(project.id)).toBeNull()

    expect(() => repos.projects.hardDeleteCascade(project.id)).not.toThrow()
    const leftover = repos.db
      .prepare(`SELECT COUNT(*) as c FROM projects WHERE id = ?`)
      .get(project.id) as { c: number }
    expect(leftover.c).toBe(0)
  })

  it('prevents deleting inbox', () => {
    const inbox = repos.projects.ensureInbox()
    expect(() => repos.projects.softDelete(inbox.id)).toThrow('Cannot delete the inbox list')
  })
})
