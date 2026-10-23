import type { Repositories } from '../db/openDatabase'
import type { RemoteColumn } from '../ticktick/remoteTypes'
import { remoteColumnToLocal } from './mappers'

/**
 * Upsert TickTick columns as local sections.
 * When `columns` is omitted (undefined/null), leave existing sections alone —
 * some `/data` responses omit the field for list-mode projects.
 * When it is an array (including empty), upsert and reconcile removals.
 */
export function upsertRemoteColumns(
  repos: Repositories,
  localProjectId: string,
  columns: RemoteColumn[] | undefined | null,
): void {
  if (!Array.isArray(columns)) return

  const activeRemoteIds = new Set<string>()
  for (const col of columns) {
    if (!col?.id) continue
    const mapped = remoteColumnToLocal(col)
    repos.sections.upsertFromRemote({
      remote_id: mapped.remote_id,
      project_id: localProjectId,
      name: mapped.name,
      sort_order: mapped.sort_order,
      remote_updated_at: mapped.remote_updated_at,
    })
    activeRemoteIds.add(mapped.remote_id)
  }
  repos.sections.reconcileMissingRemote(localProjectId, activeRemoteIds)
  repos.sections.syncDefaultsAfterPull(localProjectId, true)
}

/**
 * Map remote columnId → local section_id.
 * - No columnId → default "Not Sectioned" (when the list has sections)
 * - Known column → that section
 * - Unknown columnId → keep existing local section (columns may arrive later / omitted)
 */
export function resolveSectionIdForPull(
  repos: Repositories,
  columnRemoteId: string | null | undefined,
  existingSectionId: string | null,
  projectId: string,
): string | null {
  if (!columnRemoteId) {
    return repos.sections.getDefaultForProject(projectId)?.id ?? null
  }
  return repos.sections.getByRemoteId(columnRemoteId)?.id ?? existingSectionId
}
