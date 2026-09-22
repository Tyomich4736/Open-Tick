import type Database from 'better-sqlite3'
import type {
  CreateProjectInput,
  Project,
  ProjectViewMode,
  SyncStatus,
  UpdateProjectInput,
} from '@shared/entities'
import { asBool, newId, nowIso, toInt } from '../utils'

interface ProjectRow {
  id: string
  remote_id: string | null
  folder_id: string | null
  name: string
  color: string
  view_mode: ProjectViewMode
  kind: string
  is_inbox: number
  sort_order: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    remote_id: row.remote_id,
    folder_id: row.folder_id ?? null,
    name: row.name,
    color: row.color,
    view_mode: row.view_mode,
    kind: row.kind,
    is_inbox: asBool(row.is_inbox),
    sort_order: row.sort_order,
    sync_status: row.sync_status,
    remote_updated_at: row.remote_updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export class ProjectRepository {
  constructor(private db: Database.Database) {}

  private assertFolderExists(folderId: string | null | undefined): void {
    if (!folderId) return
    const folder = this.db
      .prepare('SELECT id FROM project_folders WHERE id = ? AND deleted_at IS NULL')
      .get(folderId)
    if (!folder) throw new Error(`Folder not found: ${folderId}`)
  }

  create(input: CreateProjectInput): Project {
    this.assertFolderExists(input.folder_id)

    const now = nowIso()
    const folderId = input.folder_id ?? null
    const sortOrder =
      (
        this.db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM projects
             WHERE deleted_at IS NULL AND folder_id IS ?`,
          )
          .get(folderId) as { next: number }
      ).next ?? 0

    const project: Project = {
      id: newId(),
      remote_id: null,
      folder_id: folderId,
      name: input.name,
      color: input.color ?? '#4772FA',
      view_mode: input.view_mode ?? 'list',
      kind: 'TASK',
      is_inbox: false,
      sort_order: sortOrder,
      sync_status: 'pending_create',
      remote_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    this.db
      .prepare(
        `INSERT INTO projects (
          id, remote_id, folder_id, name, color, view_mode, kind, is_inbox, sort_order,
          sync_status, remote_updated_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @folder_id, @name, @color, @view_mode, @kind, @is_inbox, @sort_order,
          @sync_status, @remote_updated_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run({
        ...project,
        is_inbox: toInt(project.is_inbox),
      })

    return project
  }

  update(id: string, input: UpdateProjectInput): Project {
    const existing = this.getById(id)
    if (!existing) throw new Error(`List not found: ${id}`)
    if (existing.is_inbox && input.name !== undefined) {
      throw new Error('Cannot rename the inbox list')
    }
    if (existing.is_inbox && input.folder_id !== undefined) {
      throw new Error('Cannot move the inbox list into a folder')
    }

    if (input.folder_id !== undefined) {
      this.assertFolderExists(input.folder_id)
    }

    const updated: Project = {
      ...existing,
      name: input.name ?? existing.name,
      color: input.color ?? existing.color,
      view_mode: input.view_mode ?? existing.view_mode,
      sort_order: input.sort_order ?? existing.sort_order,
      folder_id: input.folder_id !== undefined ? input.folder_id : existing.folder_id,
      updated_at: nowIso(),
      sync_status: existing.remote_id ? 'pending_update' : 'pending_create',
    }

    this.db
      .prepare(
        `UPDATE projects SET
          name = @name, color = @color, view_mode = @view_mode, sort_order = @sort_order,
          folder_id = @folder_id, sync_status = @sync_status, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run(updated)

    return updated
  }

  moveToFolder(id: string, folderId: string | null): Project {
    return this.update(id, { folder_id: folderId })
  }

  reorder(orderedIds: string[], folderId: string | null = null): void {
    const apply = this.db.transaction(() => {
      const now = nowIso()
      orderedIds.forEach((id, index) => {
        const existing = this.getById(id)
        if (!existing) throw new Error(`List not found: ${id}`)
        if (existing.is_inbox) return
        this.db
          .prepare(
            `UPDATE projects SET sort_order = @sort_order, folder_id = @folder_id,
             updated_at = @updated_at, sync_status = @sync_status WHERE id = @id`,
          )
          .run({
            id,
            sort_order: index,
            folder_id: folderId,
            updated_at: now,
            sync_status: existing.remote_id ? 'pending_update' : existing.sync_status,
          })
      })
    })
    apply()
  }

  softDelete(id: string): void {
    const existing = this.getById(id)
    if (!existing) throw new Error(`List not found: ${id}`)
    if (existing.is_inbox) throw new Error('Cannot delete the inbox list')

    const now = nowIso()
    this.db
      .prepare(
        `UPDATE projects SET deleted_at = @deleted_at, updated_at = @updated_at, sync_status = @sync_status
         WHERE id = @id`,
      )
      .run({
        id,
        deleted_at: now,
        updated_at: now,
        sync_status: existing.remote_id ? 'pending_delete' : 'synced',
      })
  }

  getById(id: string): Project | null {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL')
      .get(id) as ProjectRow | undefined
    return row ? mapProject(row) : null
  }

  list(): Project[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM projects WHERE deleted_at IS NULL
         ORDER BY is_inbox DESC, folder_id IS NOT NULL, sort_order ASC, name ASC`,
      )
      .all() as ProjectRow[]
    return rows.map(mapProject)
  }

  getInbox(): Project | null {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE is_inbox = 1 AND deleted_at IS NULL LIMIT 1')
      .get() as ProjectRow | undefined
    return row ? mapProject(row) : null
  }

  ensureInbox(): Project {
    const existing = this.getInbox()
    if (existing) return existing

    const now = nowIso()
    const project: Project = {
      id: newId(),
      remote_id: null,
      folder_id: null,
      name: 'Inbox',
      color: '#4772FA',
      view_mode: 'list',
      kind: 'TASK',
      is_inbox: true,
      sort_order: -1,
      sync_status: 'synced',
      remote_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    this.db
      .prepare(
        `INSERT INTO projects (
          id, remote_id, folder_id, name, color, view_mode, kind, is_inbox, sort_order,
          sync_status, remote_updated_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @folder_id, @name, @color, @view_mode, @kind, @is_inbox, @sort_order,
          @sync_status, @remote_updated_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run({ ...project, is_inbox: toInt(project.is_inbox) })

    return project
  }

  getByRemoteId(remoteId: string): Project | null {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE remote_id = ? AND deleted_at IS NULL LIMIT 1')
      .get(remoteId) as ProjectRow | undefined
    return row ? mapProject(row) : null
  }

  listPendingSync(): Project[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM projects
         WHERE is_inbox = 0
           AND sync_status IN ('pending_create', 'pending_update', 'pending_delete')
         ORDER BY created_at ASC`,
      )
      .all() as ProjectRow[]
    return rows.map(mapProject)
  }

  markSynced(id: string, remoteId?: string | null): void {
    const now = nowIso()
    if (remoteId) {
      this.db
        .prepare(
          `UPDATE projects SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
        )
        .run(remoteId, now, id)
    } else {
      this.db
        .prepare(`UPDATE projects SET sync_status = 'synced', updated_at = ? WHERE id = ?`)
        .run(now, id)
    }
  }

  hardDelete(id: string): void {
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  }

  private getByRemoteIdAny(remoteId: string): Project | null {
    const row = this.db
      .prepare('SELECT * FROM projects WHERE remote_id = ? LIMIT 1')
      .get(remoteId) as ProjectRow | undefined
    return row ? mapProject(row) : null
  }

  /** Bind TickTick inbox remote id onto the local inbox row. */
  setInboxRemoteId(remoteId: string): Project {
    const inbox = this.ensureInbox()
    this.db
      .prepare(
        `UPDATE projects SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
      )
      .run(remoteId, nowIso(), inbox.id)
    return this.getById(inbox.id)!
  }

  /** Inbound pull upsert — skips dirty local rows; revives soft-deleted matches. */
  upsertFromRemote(input: {
    remote_id: string
    name: string
    color: string
    view_mode: ProjectViewMode
    kind: string
    folder_id: string | null
    sort_order: number
    remote_updated_at: string | null
  }): Project {
    const existing = this.getByRemoteIdAny(input.remote_id)
    const now = nowIso()

    if (existing) {
      if (existing.deleted_at) {
        const revived: Project = {
          ...existing,
          name: input.name,
          color: input.color,
          view_mode: input.view_mode,
          kind: input.kind,
          folder_id: input.folder_id,
          sort_order: input.sort_order,
          remote_updated_at: input.remote_updated_at,
          sync_status: 'synced',
          updated_at: now,
          deleted_at: null,
        }
        this.db
          .prepare(
            `UPDATE projects SET
              name = @name, color = @color, view_mode = @view_mode, kind = @kind,
              folder_id = @folder_id, sort_order = @sort_order,
              remote_updated_at = @remote_updated_at, sync_status = @sync_status,
              updated_at = @updated_at, deleted_at = NULL
             WHERE id = @id`,
          )
          .run(revived)
        return revived
      }
      if (existing.is_inbox) {
        // Keep inbox name/local identity; only refresh remote metadata
        this.db
          .prepare(
            `UPDATE projects SET remote_id = ?, remote_updated_at = ?, sync_status = 'synced', updated_at = ?
             WHERE id = ?`,
          )
          .run(input.remote_id, input.remote_updated_at, now, existing.id)
        return this.getById(existing.id)!
      }
      if (existing.sync_status !== 'synced') return existing

      const updated: Project = {
        ...existing,
        name: input.name,
        color: input.color,
        view_mode: input.view_mode,
        kind: input.kind,
        folder_id: input.folder_id,
        sort_order: input.sort_order,
        remote_updated_at: input.remote_updated_at,
        sync_status: 'synced',
        updated_at: now,
      }
      this.db
        .prepare(
          `UPDATE projects SET
            name = @name, color = @color, view_mode = @view_mode, kind = @kind,
            folder_id = @folder_id, sort_order = @sort_order,
            remote_updated_at = @remote_updated_at, sync_status = @sync_status, updated_at = @updated_at
           WHERE id = @id`,
        )
        .run(updated)
      return updated
    }

    const project: Project = {
      id: newId(),
      remote_id: input.remote_id,
      folder_id: input.folder_id,
      name: input.name,
      color: input.color,
      view_mode: input.view_mode,
      kind: input.kind,
      is_inbox: false,
      sort_order: input.sort_order,
      sync_status: 'synced',
      remote_updated_at: input.remote_updated_at,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    this.db
      .prepare(
        `INSERT INTO projects (
          id, remote_id, folder_id, name, color, view_mode, kind, is_inbox, sort_order,
          sync_status, remote_updated_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @folder_id, @name, @color, @view_mode, @kind, @is_inbox, @sort_order,
          @sync_status, @remote_updated_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run({ ...project, is_inbox: toInt(project.is_inbox) })
    return project
  }
}
