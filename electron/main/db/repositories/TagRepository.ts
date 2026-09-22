import type Database from 'better-sqlite3'
import type { CreateTagInput, Tag } from '@shared/entities'
import { newId, nowIso } from '../utils'

interface TagRow {
  id: string
  name: string
  color: string | null
  created_at: string
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    created_at: row.created_at,
  }
}

export class TagRepository {
  constructor(private db: Database.Database) {}

  create(input: CreateTagInput): Tag {
    const existing = this.getByName(input.name)
    if (existing) return existing

    const tag: Tag = {
      id: newId(),
      name: input.name,
      color: input.color ?? null,
      created_at: nowIso(),
    }

    this.db
      .prepare('INSERT INTO tags (id, name, color, created_at) VALUES (@id, @name, @color, @created_at)')
      .run(tag)

    return tag
  }

  getByName(name: string): Tag | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE name = ?').get(name) as TagRow | undefined
    return row ? mapTag(row) : null
  }

  list(): Tag[] {
    const rows = this.db.prepare('SELECT * FROM tags ORDER BY name ASC').all() as TagRow[]
    return rows.map(mapTag)
  }

  setTaskTags(taskId: string, tagNames: string[]): void {
    const run = () => {
      this.db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(taskId)

      for (const name of tagNames) {
        const tag = this.create({ name })
        this.db
          .prepare('INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)')
          .run(taskId, tag.id)
      }
    }

    // Avoid nested db.transaction() when already inside a bulk transaction
    if (this.db.inTransaction) run()
    else this.db.transaction(run)()
  }

  getTagsForTask(taskId: string): string[] {
    const rows = this.db
      .prepare(
        `SELECT t.name FROM tags t
         INNER JOIN task_tags tt ON tt.tag_id = t.id
         WHERE tt.task_id = ?
         ORDER BY t.name ASC`,
      )
      .all(taskId) as { name: string }[]
    return rows.map((row) => row.name)
  }

  getTagsForTasks(taskIds: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>()
    if (taskIds.length === 0) return result

    const placeholders = taskIds.map(() => '?').join(', ')
    const rows = this.db
      .prepare(
        `SELECT tt.task_id, t.name FROM task_tags tt
         INNER JOIN tags t ON t.id = tt.tag_id
         WHERE tt.task_id IN (${placeholders})
         ORDER BY t.name ASC`,
      )
      .all(...taskIds) as { task_id: string; name: string }[]

    for (const row of rows) {
      const tags = result.get(row.task_id) ?? []
      tags.push(row.name)
      result.set(row.task_id, tags)
    }
    return result
  }
}
