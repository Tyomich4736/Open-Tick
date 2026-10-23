import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDatabaseInstance,
  openDatabase,
  type Repositories,
} from '../../../electron/main/db/openDatabase'
import { remoteTaskToLocal } from '../../../electron/main/sync/mappers'
import {
  resolveSectionIdForPull,
  upsertRemoteColumns,
} from '../../../electron/main/sync/sectionPull'

describe('section pull mapping', () => {
  let repos: Repositories

  beforeEach(() => {
    repos = openDatabase(':memory:')
  })

  afterEach(() => {
    if (repos?.db) closeDatabaseInstance(repos.db)
  })

  it('maps columns then task columnId to local section_id', () => {
    const project = repos.projects.create({ name: 'Work' })
    repos.projects.markSynced(project.id, 'proj-remote')

    upsertRemoteColumns(repos, project.id, [
      { id: 'col-todo', projectId: 'proj-remote', name: 'Todo', sortOrder: 0 },
      { id: 'col-doing', projectId: 'proj-remote', name: 'Doing', sortOrder: 1 },
    ])

    const sections = repos.sections.listByProject(project.id)
    expect(sections.map((s) => s.name).sort()).toEqual(['Doing', 'Not Sectioned', 'Todo'])
    expect(sections.find((s) => s.is_default)?.name).toBe('Not Sectioned')

    const mapped = remoteTaskToLocal({
      id: 'task-1',
      projectId: 'proj-remote',
      title: 'Ship sections',
      columnId: 'col-doing',
      status: 0,
    })
    expect(mapped.column_remote_id).toBe('col-doing')

    const sectionId = resolveSectionIdForPull(
      repos,
      mapped.column_remote_id,
      null,
      project.id,
    )
    const task = repos.tasks.upsertFromRemote({
      remote_id: mapped.remote_id,
      project_id: project.id,
      parent_id: null,
      section_id: sectionId,
      title: mapped.title,
      content: mapped.content,
      priority: mapped.priority,
      status: mapped.status,
      due_date: mapped.due_date,
      start_date: mapped.start_date,
      is_all_day: mapped.is_all_day,
      time_zone: mapped.time_zone,
      recurrence_rule: mapped.recurrence_rule,
      sort_order: mapped.sort_order,
      remote_updated_at: mapped.remote_updated_at,
      completed_at: mapped.completed_at,
      tags: mapped.tags,
      reminders: mapped.reminders,
    })

    expect(task.section_id).toBe(sections.find((s) => s.remote_id === 'col-doing')!.id)
    const listed = repos.tasks.list({ project_id: project.id })
    expect(listed[0]?.section_name).toBe('Doing')
  })

  it('does not wipe sections when columns field is omitted', () => {
    const project = repos.projects.create({ name: 'Work' })
    upsertRemoteColumns(repos, project.id, [
      { id: 'col-1', name: 'Keep me', sortOrder: 0 },
    ])
    expect(repos.sections.listByProject(project.id).length).toBeGreaterThanOrEqual(1)

    const before = repos.sections.listByProject(project.id).length
    upsertRemoteColumns(repos, project.id, undefined)
    expect(repos.sections.listByProject(project.id)).toHaveLength(before)

    upsertRemoteColumns(repos, project.id, null)
    expect(repos.sections.listByProject(project.id)).toHaveLength(before)
  })

  it('reconciles removed columns when columns array is present', () => {
    const project = repos.projects.create({ name: 'Work' })
    upsertRemoteColumns(repos, project.id, [
      { id: 'col-keep', name: 'Keep', sortOrder: 0 },
      { id: 'col-drop', name: 'Drop', sortOrder: 1 },
    ])
    upsertRemoteColumns(repos, project.id, [{ id: 'col-keep', name: 'Keep', sortOrder: 0 }])
    const remotes = repos.sections
      .listByProject(project.id)
      .map((s) => s.remote_id)
      .filter(Boolean)
    expect(remotes).toEqual(['col-keep'])
    expect(repos.sections.listByProject(project.id).some((s) => s.is_default)).toBe(true)
  })

  it('preserves local section when columnId is unresolved', () => {
    const project = repos.projects.create({ name: 'Work' })
    const section = repos.sections.upsertFromRemote({
      remote_id: 'col-known',
      project_id: project.id,
      name: 'Known',
      sort_order: 0,
      remote_updated_at: null,
    })
    repos.sections.syncDefaultsAfterPull(project.id, true)
    expect(resolveSectionIdForPull(repos, 'col-missing', section.id, project.id)).toBe(section.id)
    expect(resolveSectionIdForPull(repos, 'col-known', null, project.id)).toBe(section.id)
  })

  it('maps absent columnId to Not Sectioned default', () => {
    const project = repos.projects.create({ name: 'Work' })
    upsertRemoteColumns(repos, project.id, [
      { id: 'col-1', name: 'A', sortOrder: 0 },
      { id: 'col-ns', name: 'Not Sectioned', sortOrder: -1 },
    ])
    const def = repos.sections.getDefaultForProject(project.id)
    expect(def?.name).toBe('Not Sectioned')
    expect(def?.remote_id).toBe('col-ns')

    const mapped = remoteTaskToLocal({
      id: 't1',
      projectId: 'p',
      title: 'Loose',
      status: 0,
    })
    expect(mapped.column_remote_id).toBeNull()
    expect(resolveSectionIdForPull(repos, mapped.column_remote_id, null, project.id)).toBe(
      def!.id,
    )
  })

  it('adopts local Not Sectioned placeholder onto remote column', () => {
    const project = repos.projects.create({ name: 'Work' })
    repos.sections.upsertFromRemote({
      remote_id: 'col-doing',
      project_id: project.id,
      name: 'Doing',
      sort_order: 0,
      remote_updated_at: null,
    })
    const localDefault = repos.sections.ensureDefaultSection(project.id)!
    expect(localDefault.remote_id).toBeNull()

    upsertRemoteColumns(repos, project.id, [
      { id: 'col-doing', name: 'Doing', sortOrder: 0 },
      { id: 'col-ns', name: 'Not Sectioned', sortOrder: -1 },
    ])
    const after = repos.sections.getDefaultForProject(project.id)
    expect(after?.id).toBe(localDefault.id)
    expect(after?.remote_id).toBe('col-ns')
  })
})
