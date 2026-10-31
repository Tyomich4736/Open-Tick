import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDatabaseInstance,
  openDatabase,
  type Repositories,
} from '../../../electron/main/db/openDatabase'

describe('remote completion / vanish helpers', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    closeDatabaseInstance(repos.db)
  })

  it('applyRemoteCompletion marks pending dirty tasks completed and synced', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({ title: 'Done on TickTick', project_id: inbox.id })
    repos.tasks.markSynced(task.id, 'remote-1')
    repos.tasks.update(task.id, { title: 'Local edit' })
    expect(repos.tasks.getById(task.id)?.sync_status).toBe('pending_update')

    const done = repos.tasks.applyRemoteCompletion(task.id, '2026-10-30T10:00:00.000Z')
    expect(done.status).toBe('completed')
    expect(done.sync_status).toBe('synced')
    expect(done.completed_at).toBe('2026-10-30T10:00:00.000Z')
  })

  it('listSyncedPendingWithRemote includes pending_update rows', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({ title: 'Edited', project_id: inbox.id })
    repos.tasks.markSynced(task.id, 'remote-2')
    repos.tasks.update(task.id, { title: 'Edited locally' })

    const listed = repos.tasks.listSyncedPendingWithRemote(inbox.id)
    expect(listed.map((r) => r.remote_id)).toContain('remote-2')
  })

  it('markRemovedFromRemote soft-deletes without pending_delete', () => {
    const inbox = repos.projects.ensureInbox()
    const task = repos.tasks.create({ title: 'Gone', project_id: inbox.id })
    repos.tasks.markSynced(task.id, 'remote-3')
    repos.tasks.markRemovedFromRemote(task.id)

    expect(repos.tasks.getById(task.id)).toBeNull()
    expect(repos.tasks.listPendingSync()).toHaveLength(0)
  })
})
