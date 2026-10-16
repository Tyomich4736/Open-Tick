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

  it('prevents deleting inbox', () => {
    const inbox = repos.projects.ensureInbox()
    expect(() => repos.projects.softDelete(inbox.id)).toThrow('Cannot delete the inbox list')
  })
})
