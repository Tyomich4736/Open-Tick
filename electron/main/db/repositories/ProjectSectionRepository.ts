import type Database from 'better-sqlite3'
import type {
  CreateSectionInput,
  ProjectSection,
  SyncStatus,
  UpdateSectionInput,
} from '@shared/entities'
import { DEFAULT_SECTION_NAME, isDefaultSectionName } from '@shared/sections'
import { asBool, newId, nowIso, toInt } from '../utils'

interface SectionRow {
  id: string
  remote_id: string | null
  project_id: string
  name: string
  sort_order: number
  is_default: number
  sync_status: SyncStatus
  remote_updated_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

function mapSection(row: SectionRow): ProjectSection {
  return {
    id: row.id,
    remote_id: row.remote_id,
    project_id: row.project_id,
    name: row.name,
    sort_order: row.sort_order,
    is_default: asBool(row.is_default),
    sync_status: row.sync_status,
    remote_updated_at: row.remote_updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }
}

export class ProjectSectionRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateSectionInput & { is_default?: boolean }): ProjectSection {
    const project = this.db
      .prepare('SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL')
      .get(input.project_id)
    if (!project) throw new Error(`List not found: ${input.project_id}`)

    const wantDefault = Boolean(input.is_default) || isDefaultSectionName(input.name)
    if (wantDefault && this.getDefaultForProject(input.project_id)) {
      throw new Error('This list already has a default section')
    }

    const now = nowIso()
    const sortOrder =
      input.sort_order ??
      (
        this.db
          .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM project_sections
             WHERE project_id = ? AND deleted_at IS NULL`,
          )
          .get(input.project_id) as { next: number }
      ).next ??
      0

    const section: ProjectSection = {
      id: newId(),
      remote_id: null,
      project_id: input.project_id,
      name: wantDefault
        ? DEFAULT_SECTION_NAME
        : input.name.trim() || 'Untitled',
      sort_order: sortOrder,
      is_default: wantDefault,
      // Default bucket is owned by TickTick; adopt remote id on pull instead of pushing
      sync_status: wantDefault ? 'synced' : 'pending_create',
      remote_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }

    if (wantDefault) this.clearDefaultFlags(input.project_id)

    this.db
      .prepare(
        `INSERT INTO project_sections (
          id, remote_id, project_id, name, sort_order, is_default, sync_status, remote_updated_at,
          created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @project_id, @name, @sort_order, @is_default, @sync_status, @remote_updated_at,
          @created_at, @updated_at, @deleted_at
        )`,
      )
      .run({ ...section, is_default: toInt(section.is_default) })

    if (!wantDefault) this.ensureDefaultSection(input.project_id)

    return this.getById(section.id) ?? section
  }

  update(id: string, input: UpdateSectionInput): ProjectSection {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Section not found: ${id}`)

    const nextName =
      input.name !== undefined ? input.name.trim() || existing.name : existing.name

    const updated: ProjectSection = {
      ...existing,
      name: nextName,
      sort_order: input.sort_order ?? existing.sort_order,
      updated_at: nowIso(),
      sync_status: existing.remote_id ? 'pending_update' : 'pending_create',
    }

    this.db
      .prepare(
        `UPDATE project_sections SET
          name = @name, sort_order = @sort_order, sync_status = @sync_status, updated_at = @updated_at
         WHERE id = @id`,
      )
      .run(updated)

    return updated
  }

  /**
   * Soft-delete section. Default "Not Sectioned" cannot be deleted.
   * Tasks move to the default section (or null if none).
   */
  softDelete(id: string): void {
    const existing = this.getById(id)
    if (!existing) throw new Error(`Section not found: ${id}`)
    if (existing.is_default) {
      throw new Error(`Cannot delete the “${DEFAULT_SECTION_NAME}” section`)
    }

    const now = nowIso()
    const defaultId = this.getDefaultForProject(existing.project_id)?.id ?? null
    const apply = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE tasks SET
             section_id = @default_id,
             updated_at = @updated_at,
             sync_status = CASE
               WHEN remote_id IS NULL THEN sync_status
               WHEN sync_status = 'pending_create' THEN sync_status
               ELSE 'pending_update'
             END
           WHERE section_id = @id AND deleted_at IS NULL`,
        )
        .run({ id, default_id: defaultId, updated_at: now })

      this.db
        .prepare(
          `UPDATE project_sections SET
             deleted_at = @deleted_at, updated_at = @updated_at, sync_status = @sync_status
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

  getById(id: string): ProjectSection | null {
    const row = this.db
      .prepare('SELECT * FROM project_sections WHERE id = ? AND deleted_at IS NULL')
      .get(id) as SectionRow | undefined
    return row ? mapSection(row) : null
  }

  getDefaultForProject(projectId: string): ProjectSection | null {
    const row = this.db
      .prepare(
        `SELECT * FROM project_sections
         WHERE project_id = ? AND deleted_at IS NULL AND is_default = 1
         LIMIT 1`,
      )
      .get(projectId) as SectionRow | undefined
    if (row) return mapSection(row)

    // Fallback for pre-flag rows still named Not Sectioned
    const byName = this.db
      .prepare(
        `SELECT * FROM project_sections
         WHERE project_id = ? AND deleted_at IS NULL
         ORDER BY sort_order ASC, name ASC`,
      )
      .all(projectId) as SectionRow[]
    const named = byName.find((r) => isDefaultSectionName(r.name))
    return named ? mapSection(named) : null
  }

  /**
   * Ensure a default "Not Sectioned" section exists when the list already has sections.
   * Local placeholder is synced with no remote_id (TickTick already owns this column);
   * pull adopts the remote id onto this row. Returns null when the list has no sections yet.
   */
  ensureDefaultSection(projectId: string): ProjectSection | null {
    const existing = this.getDefaultForProject(projectId)
    if (existing) {
      if (!existing.is_default) this.setAsDefault(existing.id, projectId)
      return this.getById(existing.id)
    }

    const count =
      (
        this.db
          .prepare(
            `SELECT COUNT(*) as c FROM project_sections
             WHERE project_id = ? AND deleted_at IS NULL`,
          )
          .get(projectId) as { c: number }
      ).c ?? 0
    if (count === 0) return null

    const minSort =
      (
        this.db
          .prepare(
            `SELECT COALESCE(MIN(sort_order), 0) as m FROM project_sections
             WHERE project_id = ? AND deleted_at IS NULL`,
          )
          .get(projectId) as { m: number }
      ).m ?? 0

    const now = nowIso()
    this.clearDefaultFlags(projectId)
    const section: ProjectSection = {
      id: newId(),
      remote_id: null,
      project_id: projectId,
      name: DEFAULT_SECTION_NAME,
      sort_order: minSort - 1,
      is_default: true,
      // Do not push — TickTick's Not Sectioned is adopted on pull
      sync_status: 'synced',
      remote_updated_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    this.db
      .prepare(
        `INSERT INTO project_sections (
          id, remote_id, project_id, name, sort_order, is_default, sync_status, remote_updated_at,
          created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @project_id, @name, @sort_order, @is_default, @sync_status, @remote_updated_at,
          @created_at, @updated_at, @deleted_at
        )`,
      )
      .run({ ...section, is_default: toInt(section.is_default) })
    this.assignNullTasksToDefault(projectId)
    return section
  }

  /** After pull: flag Not Sectioned by name; create default if other columns exist without one. */
  syncDefaultsAfterPull(projectId: string, hadColumnsArray: boolean): void {
    if (!hadColumnsArray) return
    this.markDefaultFromNames(projectId)
    const listed = this.listByProject(projectId)
    if (listed.length === 0) return
    this.ensureDefaultSection(projectId)
    this.assignNullTasksToDefault(projectId)
  }

  markDefaultFromNames(projectId: string): void {
    const listed = this.listByProject(projectId)
    const named = listed.find((s) => isDefaultSectionName(s.name))
    if (named) this.setAsDefault(named.id, projectId)
  }

  private setAsDefault(sectionId: string, projectId: string): void {
    const apply = this.db.transaction(() => {
      this.clearDefaultFlags(projectId)
      this.db
        .prepare(`UPDATE project_sections SET is_default = 1 WHERE id = ?`)
        .run(sectionId)
    })
    apply()
  }

  private clearDefaultFlags(projectId: string): void {
    this.db
      .prepare(`UPDATE project_sections SET is_default = 0 WHERE project_id = ?`)
      .run(projectId)
  }

  /** Attach tasks with null section_id to the default section (pull / heal). Keeps sync_status. */
  assignNullTasksToDefault(projectId: string): void {
    const def = this.getDefaultForProject(projectId)
    if (!def) return
    this.db
      .prepare(
        `UPDATE tasks SET section_id = ?, updated_at = ?
         WHERE project_id = ? AND section_id IS NULL AND deleted_at IS NULL`,
      )
      .run(def.id, nowIso(), projectId)
  }

  listByProject(projectId: string): ProjectSection[] {
    const query = () =>
      this.db
        .prepare(
          `SELECT * FROM project_sections
           WHERE project_id = ? AND deleted_at IS NULL
           ORDER BY sort_order ASC, name ASC`,
        )
        .all(projectId) as SectionRow[]

    let rows = query()
    // Heal lists that have sections but no default bucket (e.g. pre-flag data)
    if (
      rows.length > 0 &&
      !rows.some((r) => asBool(r.is_default) || isDefaultSectionName(r.name))
    ) {
      this.ensureDefaultSection(projectId)
      rows = query()
    }
    return rows.map(mapSection)
  }

  reorder(projectId: string, orderedIds: string[]): void {
    const apply = this.db.transaction(() => {
      const now = nowIso()
      orderedIds.forEach((id, index) => {
        const existing = this.getById(id)
        if (!existing) throw new Error(`Section not found: ${id}`)
        if (existing.project_id !== projectId) {
          throw new Error('Section does not belong to this list')
        }
        this.db
          .prepare(
            `UPDATE project_sections SET sort_order = @sort_order, updated_at = @updated_at,
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

  getByRemoteId(remoteId: string): ProjectSection | null {
    const row = this.db
      .prepare(
        'SELECT * FROM project_sections WHERE remote_id = ? AND deleted_at IS NULL LIMIT 1',
      )
      .get(remoteId) as SectionRow | undefined
    return row ? mapSection(row) : null
  }

  listPendingSync(): ProjectSection[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM project_sections
         WHERE sync_status IN ('pending_create', 'pending_update', 'pending_delete')
         ORDER BY created_at ASC`,
      )
      .all() as SectionRow[]
    return rows.map(mapSection)
  }

  markSynced(id: string, remoteId?: string | null): void {
    const now = nowIso()
    if (remoteId) {
      this.db
        .prepare(
          `UPDATE project_sections SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
        )
        .run(remoteId, now, id)
    } else {
      this.db
        .prepare(`UPDATE project_sections SET sync_status = 'synced', updated_at = ? WHERE id = ?`)
        .run(now, id)
    }
  }

  hardDelete(id: string): void {
    this.db.prepare('DELETE FROM project_sections WHERE id = ?').run(id)
  }

  private getByRemoteIdAny(remoteId: string): ProjectSection | null {
    const row = this.db
      .prepare('SELECT * FROM project_sections WHERE remote_id = ? LIMIT 1')
      .get(remoteId) as SectionRow | undefined
    return row ? mapSection(row) : null
  }

  /** Inbound pull upsert — skips dirty local rows; revives soft-deleted matches. */
  upsertFromRemote(input: {
    remote_id: string
    project_id: string
    name: string
    sort_order: number
    remote_updated_at: string | null
  }): ProjectSection {
    let existing = this.getByRemoteIdAny(input.remote_id)
    const now = nowIso()
    const isDefault = isDefaultSectionName(input.name)

    // Adopt local default placeholder (no remote_id) onto TickTick's Not Sectioned
    if (!existing && isDefault) {
      const localDefault = this.getDefaultForProject(input.project_id)
      if (localDefault && !localDefault.remote_id) {
        existing = localDefault
      }
    }

    if (existing) {
      if (existing.deleted_at) {
        if (isDefault) this.clearDefaultFlags(input.project_id)
        const revived: ProjectSection = {
          ...existing,
          remote_id: input.remote_id,
          project_id: input.project_id,
          name: input.name,
          sort_order: input.sort_order,
          is_default: isDefault || existing.is_default,
          remote_updated_at: input.remote_updated_at,
          sync_status: 'synced',
          updated_at: now,
          deleted_at: null,
        }
        this.db
          .prepare(
            `UPDATE project_sections SET
              remote_id = @remote_id, project_id = @project_id, name = @name, sort_order = @sort_order,
              is_default = @is_default, remote_updated_at = @remote_updated_at,
              sync_status = @sync_status, updated_at = @updated_at, deleted_at = NULL
             WHERE id = @id`,
          )
          .run({ ...revived, is_default: toInt(revived.is_default) })
        return revived
      }
      if (existing.sync_status !== 'synced' && existing.remote_id) return existing
      if (isDefault) this.clearDefaultFlags(input.project_id)
      const updated: ProjectSection = {
        ...existing,
        remote_id: input.remote_id,
        project_id: input.project_id,
        name: input.name,
        sort_order: input.sort_order,
        is_default: isDefault || existing.is_default,
        remote_updated_at: input.remote_updated_at,
        sync_status: 'synced',
        updated_at: now,
      }
      this.db
        .prepare(
          `UPDATE project_sections SET
            remote_id = @remote_id, project_id = @project_id, name = @name, sort_order = @sort_order,
            is_default = @is_default, remote_updated_at = @remote_updated_at,
            sync_status = @sync_status, updated_at = @updated_at
           WHERE id = @id`,
        )
        .run({ ...updated, is_default: toInt(updated.is_default) })
      return updated
    }

    if (isDefault) this.clearDefaultFlags(input.project_id)
    const section: ProjectSection = {
      id: newId(),
      remote_id: input.remote_id,
      project_id: input.project_id,
      name: input.name,
      sort_order: input.sort_order,
      is_default: isDefault,
      sync_status: 'synced',
      remote_updated_at: input.remote_updated_at,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    }
    this.db
      .prepare(
        `INSERT INTO project_sections (
          id, remote_id, project_id, name, sort_order, is_default, sync_status, remote_updated_at,
          created_at, updated_at, deleted_at
        ) VALUES (
          @id, @remote_id, @project_id, @name, @sort_order, @is_default, @sync_status, @remote_updated_at,
          @created_at, @updated_at, @deleted_at
        )`,
      )
      .run({ ...section, is_default: toInt(section.is_default) })
    return section
  }

  /**
   * Soft-delete local synced sections for a project whose remote ids are gone.
   * Never removes the default section. Other sections' tasks move to default.
   */
  reconcileMissingRemote(
    projectId: string,
    activeRemoteIds: Set<string>,
  ): number {
    const rows = this.db
      .prepare(
        `SELECT * FROM project_sections
         WHERE project_id = ? AND deleted_at IS NULL
           AND sync_status = 'synced' AND remote_id IS NOT NULL`,
      )
      .all(projectId) as SectionRow[]

    let count = 0
    const now = nowIso()
    const apply = this.db.transaction(() => {
      const defaultId =
        rows.find((r) => asBool(r.is_default) || isDefaultSectionName(r.name))?.id ?? null
      for (const row of rows) {
        if (!row.remote_id || activeRemoteIds.has(row.remote_id)) continue
        if (asBool(row.is_default) || isDefaultSectionName(row.name)) continue
        const target = defaultId && defaultId !== row.id ? defaultId : null
        this.db
          .prepare(
            `UPDATE tasks SET section_id = ?, updated_at = ? WHERE section_id = ? AND deleted_at IS NULL`,
          )
          .run(target, now, row.id)
        this.db
          .prepare(
            `UPDATE project_sections SET deleted_at = ?, updated_at = ?, sync_status = 'synced' WHERE id = ?`,
          )
          .run(now, now, row.id)
        count += 1
      }
    })
    apply()
    return count
  }
}
