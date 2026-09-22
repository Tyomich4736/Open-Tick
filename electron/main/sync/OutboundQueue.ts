import { getRepositories } from '../db/connection'
import { newId, nowIso } from '../db/utils'

export type QueueOperation = 'create' | 'update' | 'complete' | 'delete'
export type QueueEntityType = 'task' | 'project' | 'folder'

export interface QueueItem {
  id: string
  entity_type: QueueEntityType
  entity_id: string
  operation: QueueOperation
  payload: string // JSON string of the data needed for the operation
  attempts: number
  last_error: string | null
  created_at: string
  scheduled_at: string
}

/**
 * Outbound queue manager (Phase 14).
 * Enqueue helpers for future mutation hooks; push execution currently drains
 * dirty `sync_status` rows via `pushDirtyEntities` (see SyncEngine).
 */
export class OutboundQueue {
  private get db() {
    return getRepositories().db
  }

  enqueue(params: {
    entity_type: QueueEntityType
    entity_id: string
    operation: QueueOperation
    payload: unknown
  }): void {
    // Dedupe: for non-create operations, remove any existing pending item for the same entity
    if (params.operation !== 'create') {
      this.db
        .prepare(
          `DELETE FROM sync_queue
           WHERE entity_type = ? AND entity_id = ? AND operation != 'create'`,
        )
        .run(params.entity_type, params.entity_id)
    }

    const now = nowIso()
    const item: QueueItem = {
      id: newId(),
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      operation: params.operation,
      payload: JSON.stringify(params.payload),
      attempts: 0,
      last_error: null,
      created_at: now,
      scheduled_at: now,
    }

    this.db
      .prepare(
        `INSERT INTO sync_queue
         (id, entity_type, entity_id, operation, payload, attempts, last_error, created_at, scheduled_at)
         VALUES (@id, @entity_type, @entity_id, @operation, @payload, @attempts, @last_error, @created_at, @scheduled_at)`,
      )
      .run(item)
  }

  /** Returns the next batch of items that are ready to be processed (read-only view). */
  nextBatch(limit = 20): QueueItem[] {
    return this.db
      .prepare(
        `SELECT * FROM sync_queue
         WHERE scheduled_at <= ?
         ORDER BY scheduled_at ASC
         LIMIT ?`,
      )
      .all(nowIso(), limit) as QueueItem[]
  }

  /** Mark an item as permanently done (delete it). */
  markDone(id: string): void {
    this.db.prepare('DELETE FROM sync_queue WHERE id = ?').run(id)
  }

  /** Record a failure and schedule retry with exponential backoff. */
  recordFailure(id: string, error: string): void {
    const item = this.db
      .prepare('SELECT attempts FROM sync_queue WHERE id = ?')
      .get(id) as { attempts: number } | undefined
    if (!item) return

    const attempts = item.attempts + 1
    const backoffMinutes = Math.min(60, Math.pow(2, attempts)) // 1, 2, 4, 8, ... up to 60 min
    const next = new Date(Date.now() + backoffMinutes * 60_000).toISOString()

    this.db
      .prepare(
        `UPDATE sync_queue
         SET attempts = ?, last_error = ?, scheduled_at = ?
         WHERE id = ?`,
      )
      .run(attempts, error, next, id)
  }

  /** Clear all items (emergency / testing only — does not affect remote data). */
  clearAll(): void {
    this.db.prepare('DELETE FROM sync_queue').run()
  }

  countPending(): number {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM sync_queue').get() as {
      c: number
    }
    return row.c
  }
}

let queue: OutboundQueue | null = null

export function getOutboundQueue(): OutboundQueue {
  if (!queue) queue = new OutboundQueue()
  return queue
}

export function resetOutboundQueueForTests(): void {
  queue = null
}
