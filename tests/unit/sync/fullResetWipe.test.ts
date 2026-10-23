import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDatabaseInstance,
  openDatabase,
  type Repositories,
} from '../../../electron/main/db/openDatabase'

/**
 * Mirrors the FK-safe wipe order in handleSyncFullResetAndPull.
 * Regression: wiping projects while project_sections still exist fails FK.
 */
function wipeLocalData(repos: Repositories): void {
  const db = repos.db
  db.exec(`
    DELETE FROM sticky_notes;
    DELETE FROM task_reminders;
    DELETE FROM task_tags;
    DELETE FROM tasks;
    DELETE FROM project_sections;
    DELETE FROM tags;
    DELETE FROM projects WHERE is_inbox = 0;
    DELETE FROM project_folders;
    DELETE FROM sync_queue;
    UPDATE sync_state SET last_full_sync_at = NULL, inbox_remote_id = NULL, last_error = NULL;
  `)
  repos.projects.ensureInbox()
}

describe('full reset wipe', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    if (repos?.db) closeDatabaseInstance(repos.db)
  })

  it('clears projects that have sections without FK errors', () => {
    const project = repos.projects.create({ name: 'Work' })
    const section = repos.sections.create({ project_id: project.id, name: 'Doing' })
    repos.tasks.create({
      title: 'Task',
      project_id: project.id,
      section_id: section.id,
    })

    expect(() => wipeLocalData(repos)).not.toThrow()
    expect(repos.projects.list().every((p) => p.is_inbox)).toBe(true)
    expect(repos.sections.listByProject(project.id)).toHaveLength(0)
    expect(repos.tasks.list({})).toHaveLength(0)
  })
})
