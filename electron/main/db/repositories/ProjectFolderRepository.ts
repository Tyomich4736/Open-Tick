import type Database from 'better-sqlite3'
import type {
  CreateFolderInput,
  ProjectFolder,
  SyncStatus,
  UpdateFolderInput,
} from '@shared/entities'
import { newId, nowIso } from '../utils'

interface FolderRow {
  id: string
  remote_id: string | null
  name: string
  sort_order: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function mapFolder(row: FolderRow): ProjectFolder {
  return {
    id: row.id,
    remote_id: row.remote_id,
    name: row.name,
    sort_order: row.sort_order,
    sync_status: row.sync_status,
    remote_updated_at: row.remote_updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export class ProjectFolderRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateFolderInput): ProjectFolder {
    const now = nowIso()
    const sortOrder =
      (
        this.db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM project_folders WHERE deleted_at IS NULL`,
          )
          .get() as { next: number }
      ).next ?? 0

    const folder: ProjectFolder = {
      id: newId(),
      remote_id: null,
      name: input.name.trim(),
      sort_order: sortOrder,
      sync_status: 'pending_create',
      remote_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    this.db
      .prepare(
        `INSERT INTO project_folders (
          id, remote_id, name, sort_order, sync_status, remote_updated_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @name, @sort_order, @sync_status, @remote_updated_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run(folder)

    return folder
  }

  update(id: string, input: UpdateFolderInput): ProjectFolder {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Folder not found: ${id}`)

    const updated: ProjectFolder = {
      ...existing,
      name: input.name?.trim() ?? existing.name,
      sort_order: input.sort_order ?? existing.sort_order,
      updated_at: nowIso(),
      sync_status: existing.remote_id ? 'pending_update' : 'pending_create',
    }

    this.db
      .prepare(
        `UPDATE project_folders SET
          name = @name, sort_order = @sort_order, sync_status = @sync_status, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run(updated)

    return updated
  }

  /** Soft-delete folder and move contained projects to top level */
  softDelete(id: string): void {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Folder not found: ${id}`)

    const now = nowIso()
    const apply = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE projects SET folder_id = NULL, updated_at = @updated_at,
           sync_status = CASE WHEN remote_id IS NULL THEN sync_status ELSE 'pending_update' END
           WHERE folder_id = @id AND deleted_at IS NULL`,
        )
        .run({ id, updated_at: now })

      this.db
        .prepare(
          `UPDATE project_folders SET deleted_at = @deleted_at, updated_at = @updated_at, sync_status = @sync_status
           WHERE id = @id`,
        )
        .run({
          id,
          deleted_at: now,
          updated_at: now,
          sync_status: existing.remote_id ? 'pending_delete' : 'synced',
        })
    })
    apply()
  }

  getById(id: string): ProjectFolder | null {
    const row = this.db
      .prepare('SELECT * FROM project_folders WHERE id = ? AND deleted_at IS NULL')
      .get(id) as FolderRow | undefined
    return row ? mapFolder(row) : null
  }

  list(): ProjectFolder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM project_folders WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC`,
      )
      .all() as FolderRow[]
    return rows.map(mapFolder)
  }

  reorder(orderedIds: string[]): void {
    const apply = this.db.transaction(() => {
      const now = nowIso()
      orderedIds.forEach((id, index) => {
        const existing = this.getById(id)
        if (!existing) throw new Error(`Folder not found: ${id}`)
        this.db
          .prepare(
            `UPDATE project_folders SET sort_order = @sort_order, updated_at = @updated_at,
             sync_status = @sync_status WHERE id = @id`,
          )
          .run({
            id,
            sort_order: index,
            updated_at: now,
            sync_status: existing.remote_id ? 'pending_update' : existing.sync_status,
          })
      })
    })
    apply()
  }

  getByRemoteId(remoteId: string): ProjectFolder | null {
    const row = this.db
      .prepare(
        'SELECT * FROM project_folders WHERE remote_id = ? AND deleted_at IS NULL LIMIT 1',
      )
      .get(remoteId) as FolderRow | undefined
    return row ? mapFolder(row) : null
  }

  listPendingSync(): ProjectFolder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM project_folders
         WHERE sync_status IN ('pending_create', 'pending_update', 'pending_delete')
         ORDER BY created_at ASC`,
      )
      .all() as FolderRow[]
    return rows.map(mapFolder)
  }

  markSynced(id: string, remoteId?: string | null): void {
    const now = nowIso()
    if (remoteId) {
      this.db
        .prepare(
          `UPDATE project_folders SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
        )
        .run(remoteId, now, id)
    } else {
      this.db
        .prepare(`UPDATE project_folders SET sync_status = 'synced', updated_at = ? WHERE id = ?`)
        .run(now, id)
    }
  }

  hardDelete(id: string): void {
    this.db.prepare('DELETE FROM project_folders WHERE id = ?').run(id)
  }

  /** Includes soft-deleted rows (needed for pull revive). */
  private getByRemoteIdAny(remoteId: string): ProjectFolder | null {
    const row = this.db
      .prepare('SELECT * FROM project_folders WHERE remote_id = ? LIMIT 1')
      .get(remoteId) as FolderRow | undefined
    return row ? mapFolder(row) : null
  }

  /** Inbound pull upsert — skips dirty local rows; revives soft-deleted matches. */
  upsertFromRemote(input: {
    remote_id: string
    name: string
    sort_order: number
    remote_updated_at: string | null
  }): ProjectFolder {
    const existing = this.getByRemoteIdAny(input.remote_id)
    const now = nowIso()

    if (existing) {
      // Soft-deleted (or pending_delete) after local cleanup — revive from remote.
      if (existing.deleted_at) {
        const revived: ProjectFolder = {
          ...existing,
          name: input.name,
          sort_order: input.sort_order,
          remote_updated_at: input.remote_updated_at,
          sync_status: 'synced',
          updated_at: now,
          deleted_at: null,
        }
        this.db
          .prepare(
            `UPDATE project_folders SET
              name = @name, sort_order = @sort_order, remote_updated_at = @remote_updated_at,
              sync_status = @sync_status, updated_at = @updated_at, deleted_at = NULL
             WHERE id = @id`,
          )
          .run(revived)
        return revived
      }
      if (existing.sync_status !== 'synced') return existing
      const updated: ProjectFolder = {
        ...existing,
        name: input.name,
        sort_order: input.sort_order,
        remote_updated_at: input.remote_updated_at,
        sync_status: 'synced',
        updated_at: now,
      }
      this.db
        .prepare(
          `UPDATE project_folders SET
            name = @name, sort_order = @sort_order, remote_updated_at = @remote_updated_at,
            sync_status = @sync_status, updated_at = @updated_at
           WHERE id = @id`,
        )
        .run(updated)
      return updated
    }

    const folder: ProjectFolder = {
      id: newId(),
      remote_id: input.remote_id,
      name: input.name,
      sort_order: input.sort_order,
      sync_status: 'synced',
      remote_updated_at: input.remote_updated_at,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    this.db
      .prepare(
        `INSERT INTO project_folders (
          id, remote_id, name, sort_order, sync_status, remote_updated_at, created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @name, @sort_order, @sync_status, @remote_updated_at, @created_at, @updated_at, @deleted_at
        )`,
      )
      .run(folder)
    return folder
  }
}
