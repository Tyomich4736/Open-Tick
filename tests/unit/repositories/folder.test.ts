import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { Repositories } from '../../../electron/main/db/openDatabase'
import { closeDatabaseInstance, openDatabase } from '../../../electron/main/db/openDatabase'

describe('ProjectFolderRepository', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    if (repos?.db) closeDatabaseInstance(repos.db)
  })

  it('creates and lists folders', () => {
    const folder = repos.folders.create({ name: 'Work' })
    const list = repos.folders.list()

    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(folder.id)
    expect(list[0].name).toBe('Work')
  })

  it('renames a folder', () => {
    const folder = repos.folders.create({ name: 'Work' })
    const updated = repos.folders.update(folder.id, { name: 'Personal' })

    expect(updated.name).toBe('Personal')
    expect(updated.sync_status).toBe('pending_create')
  })

  it('assigns projects to a folder and reorders within it', () => {
    const folder = repos.folders.create({ name: 'Work' })
    const a = repos.projects.create({ name: 'A', folder_id: folder.id })
    const b = repos.projects.create({ name: 'B', folder_id: folder.id })

    expect(repos.projects.getById(a.id)?.folder_id).toBe(folder.id)
    expect(repos.projects.getById(b.id)?.folder_id).toBe(folder.id)

    repos.projects.reorder([b.id, a.id], folder.id)
    expect(repos.projects.getById(b.id)?.sort_order).toBe(0)
    expect(repos.projects.getById(a.id)?.sort_order).toBe(1)
  })

  it('moves a project into and out of a folder', () => {
    const folder = repos.folders.create({ name: 'Work' })
    const project = repos.projects.create({ name: 'Solo' })

    repos.projects.moveToFolder(project.id, folder.id)
    expect(repos.projects.getById(project.id)?.folder_id).toBe(folder.id)

    repos.projects.moveToFolder(project.id, null)
    expect(repos.projects.getById(project.id)?.folder_id).toBeNull()
  })

  it('soft-deletes a folder and ungroups projects', () => {
    const folder = repos.folders.create({ name: 'Work' })
    const project = repos.projects.create({ name: 'Nested', folder_id: folder.id })

    repos.folders.softDelete(folder.id)

    expect(repos.folders.getById(folder.id)).toBeNull()
    expect(repos.projects.getById(project.id)).not.toBeNull()
    expect(repos.projects.getById(project.id)?.folder_id).toBeNull()
  })

  it('reorders folders', () => {
    const a = repos.folders.create({ name: 'A' })
    const b = repos.folders.create({ name: 'B' })

    repos.folders.reorder([b.id, a.id])

    const list = repos.folders.list()
    expect(list.map((f) => f.id)).toEqual([b.id, a.id])
  })

  it('revives soft-deleted folder on pull upsert (same remote_id)', () => {
    const folder = repos.folders.upsertFromRemote({
      remote_id: 'remote-folder-1',
      name: 'Work',
      sort_order: 0,
      remote_updated_at: null,
    })
    repos.folders.softDelete(folder.id)
    expect(repos.folders.getById(folder.id)).toBeNull()

    const revived = repos.folders.upsertFromRemote({
      remote_id: 'remote-folder-1',
      name: 'Work Renamed',
      sort_order: 2,
      remote_updated_at: '2026-09-03T00:00:00.000Z',
    })

    expect(revived.id).toBe(folder.id)
    expect(revived.name).toBe('Work Renamed')
    expect(revived.sort_order).toBe(2)
    expect(revived.deleted_at).toBeNull()
    expect(revived.sync_status).toBe('synced')
    expect(repos.folders.getById(folder.id)?.name).toBe('Work Renamed')
  })
})
