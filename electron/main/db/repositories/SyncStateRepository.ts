import type Database from 'better-sqlite3'
import { asBool, toInt } from '../utils'

export interface SyncStateRow {
  last_full_sync_at: string | null
  last_incremental_sync_at: string | null
  inbox_remote_id: string | null
  is_syncing: boolean
  last_error: string | null
}

export class SyncStateRepository {
  constructor(private db: Database.Database) {}

  get(): SyncStateRow {
    const row = this.db.prepare('SELECT * FROM sync_state WHERE id = 1').get() as
      | {
          last_full_sync_at: string | null
          last_incremental_sync_at: string | null
          inbox_remote_id: string | null
          is_syncing: number
          last_error: string | null
        }
      | undefined

    if (!row) {
      this.db.prepare('INSERT OR IGNORE INTO sync_state (id) VALUES (1)').run()
      return {
        last_full_sync_at: null,
        last_incremental_sync_at: null,
        inbox_remote_id: null,
        is_syncing: false,
        last_error: null,
      }
    }

    return {
      last_full_sync_at: row.last_full_sync_at,
      last_incremental_sync_at: row.last_incremental_sync_at,
      inbox_remote_id: row.inbox_remote_id,
      is_syncing: asBool(row.is_syncing),
      last_error: row.last_error,
    }
  }

  setSyncing(isSyncing: boolean): void {
    this.db
      .prepare('UPDATE sync_state SET is_syncing = ? WHERE id = 1')
      .run(toInt(isSyncing))
  }

  setInboxRemoteId(remoteId: string | null): void {
    this.db
      .prepare('UPDATE sync_state SET inbox_remote_id = ? WHERE id = 1')
      .run(remoteId)
  }

  markFullSyncSuccess(options?: { warning?: string | null }): void {
    const now = new Date().toISOString()
    this.db
      .prepare(
        `UPDATE sync_state SET
          last_full_sync_at = ?,
          last_incremental_sync_at = ?,
          is_syncing = 0,
          last_error = ?
         WHERE id = 1`,
      )
      .run(now, now, options?.warning ?? null)
  }

  markError(message: string): void {
    this.db
      .prepare(
        `UPDATE sync_state SET is_syncing = 0, last_error = ? WHERE id = 1`,
      )
      .run(message)
  }
}
