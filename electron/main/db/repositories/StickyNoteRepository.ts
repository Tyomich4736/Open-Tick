import type Database from 'better-sqlite3'
import type { StickyBoundsPatch, StickyNote } from '@shared/entities'
import { DESKTOP_DEFAULTS, DESKTOP_SETTING_KEYS } from '@shared/desktopSettings'
import { asBool, newId, nowIso, toInt } from '../utils'

interface StickyRow {
  id: string
  task_id: string
  window_x: number
  window_y: number
  width: number
  height: number
  is_pinned: number
  is_collapsed: number
  color: string | null
  created_at: string
  updated_at: string
}

function mapRow(row: StickyRow): StickyNote {
  return {
    id: row.id,
    task_id: row.task_id,
    window_x: row.window_x,
    window_y: row.window_y,
    width: row.width,
    height: row.height,
    is_pinned: asBool(row.is_pinned),
    is_collapsed: asBool(row.is_collapsed),
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export const STICKY_DEFAULTS = {
  width: 300,
  height: 340,
  minWidth: 240,
  minHeight: 180,
  maxWidth: 600,
  maxHeight: 800,
} as const

export class StickyNoteRepository {
  constructor(private db: Database.Database) {}

  list(): StickyNote[] {
    const rows = this.db
      .prepare(
        `SELECT s.* FROM sticky_notes s
         INNER JOIN tasks t ON t.id = s.task_id AND t.deleted_at IS NULL
         ORDER BY s.created_at ASC`,
      )
      .all() as StickyRow[]
    return rows.map(mapRow)
  }

  getByTaskId(taskId: string): StickyNote | null {
    const row = this.db
      .prepare('SELECT * FROM sticky_notes WHERE task_id = ?')
      .get(taskId) as StickyRow | undefined
    return row ? mapRow(row) : null
  }

  getById(id: string): StickyNote | null {
    const row = this.db.prepare('SELECT * FROM sticky_notes WHERE id = ?').get(id) as
      | StickyRow
      | undefined
    return row ? mapRow(row) : null
  }

  /** Create or return existing sticky for task. */
  openForTask(
    taskId: string,
    bounds?: Partial<Pick<StickyNote, 'window_x' | 'window_y' | 'width' | 'height'>>,
  ): StickyNote {
    const existing = this.getByTaskId(taskId)
    if (existing) return existing

    const last = this.db
      .prepare('SELECT window_x, window_y FROM sticky_notes ORDER BY created_at DESC LIMIT 1')
      .get() as { window_x: number; window_y: number } | undefined

    const pinDefault =
      (
        this.db.prepare('SELECT value FROM settings WHERE key = ?').get(
          DESKTOP_SETTING_KEYS.stickyPinByDefault,
        ) as { value: string } | undefined
      )?.value ?? null
    let pinByDefault: boolean = DESKTOP_DEFAULTS.stickyPinByDefault
    if (pinDefault != null) {
      try {
        pinByDefault = Boolean(JSON.parse(pinDefault))
      } catch {
        /* keep default */
      }
    }

    const now = nowIso()
    const sticky: StickyNote = {
      id: newId(),
      task_id: taskId,
      window_x: bounds?.window_x ?? (last ? last.window_x + 28 : 120),
      window_y: bounds?.window_y ?? (last ? last.window_y + 28 : 120),
      width: bounds?.width ?? STICKY_DEFAULTS.width,
      height: bounds?.height ?? STICKY_DEFAULTS.height,
      is_pinned: pinByDefault,
      is_collapsed: false,
      color: null,
      created_at: now,
      updated_at: now,
    }

    this.db
      .prepare(
        `INSERT INTO sticky_notes (
          id, task_id, window_x, window_y, width, height,
          is_pinned, is_collapsed, color, created_at, updated_at
        ) VALUES (
          @id, @task_id, @window_x, @window_y, @width, @height,
          @is_pinned, @is_collapsed, @color, @created_at, @updated_at
        )`,
      )
      .run({
        ...sticky,
        is_pinned: toInt(sticky.is_pinned),
        is_collapsed: toInt(sticky.is_collapsed),
      })

    return sticky
  }

  updateBounds(taskId: string, patch: StickyBoundsPatch): StickyNote {
    const existing = this.getByTaskId(taskId)
    if (!existing) throw new Error(`Sticky not found for task: ${taskId}`)

    const updated: StickyNote = {
      ...existing,
      window_x: patch.window_x ?? existing.window_x,
      window_y: patch.window_y ?? existing.window_y,
      width: patch.width ?? existing.width,
      height: patch.height ?? existing.height,
      is_collapsed:
        patch.is_collapsed !== undefined ? patch.is_collapsed : existing.is_collapsed,
      color: patch.color !== undefined ? patch.color : existing.color,
      updated_at: nowIso(),
    }

    this.db
      .prepare(
        `UPDATE sticky_notes SET
          window_x = @window_x, window_y = @window_y,
          width = @width, height = @height,
          is_collapsed = @is_collapsed, color = @color, updated_at = @updated_at
         WHERE task_id = @task_id`,
      )
      .run({
        task_id: taskId,
        window_x: updated.window_x,
        window_y: updated.window_y,
        width: updated.width,
        height: updated.height,
        is_collapsed: toInt(updated.is_collapsed),
        color: updated.color,
        updated_at: updated.updated_at,
      })

    return updated
  }

  setPinned(taskId: string, isPinned: boolean): StickyNote {
    const existing = this.getByTaskId(taskId)
    if (!existing) throw new Error(`Sticky not found for task: ${taskId}`)

    const updated_at = nowIso()
    this.db
      .prepare(
        `UPDATE sticky_notes SET is_pinned = ?, updated_at = ? WHERE task_id = ?`,
      )
      .run(toInt(isPinned), updated_at, taskId)

    return { ...existing, is_pinned: isPinned, updated_at }
  }

  /** Close sticky — removes window state row; task remains. */
  close(taskId: string): void {
    this.db.prepare('DELETE FROM sticky_notes WHERE task_id = ?').run(taskId)
  }
}
