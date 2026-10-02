# Local Storage

SQLite database managed exclusively in the **Electron main process** via `better-sqlite3`.

---

## File locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\Open Tick\opentick.db` |
| macOS | `~/Library/Application Support/Open Tick/opentick.db` |
| Linux | `~/.config/Open Tick/opentick.db` |

Additional files in same directory:

| File | Purpose |
|------|---------|
| `opentick.db-wal` | WAL journal (SQLite) |
| `auth.enc` | Encrypted OAuth tokens (if safeStorage unavailable) |
| `logs/main.log` | electron-log output |
| `backups/` | Manual/auto DB backups |

Use `app.getPath('userData')` to resolve base directory.

---

## SQLite configuration

```typescript
const db = new Database(dbPath, {
  verbose: isDev ? console.log : undefined,
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
```

**Why WAL:** better concurrent read performance while sync worker writes.

---

## Schema version 1

Migration file: `electron/main/db/migrations/001_initial.sql`

```sql
-- schema_migrations
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- projects
CREATE TABLE projects (
  id                  TEXT PRIMARY KEY,
  remote_id           TEXT UNIQUE,
  name                TEXT NOT NULL,
  color               TEXT NOT NULL DEFAULT '#4772FA',
  view_mode           TEXT NOT NULL DEFAULT 'list',
  kind                TEXT NOT NULL DEFAULT 'TASK',
  is_inbox            INTEGER NOT NULL DEFAULT 0,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  sync_status         TEXT NOT NULL DEFAULT 'synced',
  remote_updated_at   TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT
);

CREATE INDEX idx_projects_remote_id ON projects(remote_id);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);

-- tasks
CREATE TABLE tasks (
  id                  TEXT PRIMARY KEY,
  remote_id           TEXT UNIQUE,
  project_id          TEXT NOT NULL REFERENCES projects(id),
  parent_id           TEXT REFERENCES tasks(id),
  title               TEXT NOT NULL,
  content             TEXT NOT NULL DEFAULT '',
  priority            INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'pending',
  due_date            TEXT,
  start_date          TEXT,
  is_all_day          INTEGER NOT NULL DEFAULT 0,
  time_zone           TEXT,
  recurrence_rule     TEXT,                          -- JSON RecurrenceRule
  recurrence_parent_id TEXT REFERENCES tasks(id),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  sync_status         TEXT NOT NULL DEFAULT 'synced',
  remote_updated_at   TEXT,
  completed_at        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_remote_id ON tasks(remote_id);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX idx_tasks_sync ON tasks(sync_status);
CREATE INDEX idx_tasks_recurrence_parent ON tasks(recurrence_parent_id);

-- task_reminders (migration 004)
CREATE TABLE task_reminders (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('before', 'at_due', 'after')),
  offset_minutes   INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_task_reminders_task ON task_reminders(task_id);

-- tags
CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE task_tags (
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);

-- sync_queue
CREATE TABLE sync_queue (
  id            TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  operation     TEXT NOT NULL,
  payload       TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TEXT NOT NULL,
  scheduled_at  TEXT NOT NULL
);

CREATE INDEX idx_sync_queue_scheduled ON sync_queue(scheduled_at);

-- sync_state (singleton)
CREATE TABLE sync_state (
  id                         INTEGER PRIMARY KEY CHECK (id = 1),
  last_full_sync_at          TEXT,
  last_incremental_sync_at   TEXT,
  inbox_remote_id            TEXT,
  is_syncing                 INTEGER NOT NULL DEFAULT 0,
  last_error                 TEXT
);

INSERT INTO sync_state (id) VALUES (1);

-- settings
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- default settings
INSERT INTO settings (key, value) VALUES
  ('theme', '"system"'),
  ('timezone', '"UTC"'),
  ('week_starts_on', '1'),
  ('notifications_enabled', 'true'),
  ('notification_lead_minutes', '15'),
  ('sync_interval_minutes', '3'),
  ('minimize_to_tray', 'false');
```

---

## Migration runner

```typescript
interface Migration {
  version: number;
  up: (db: Database) => void;
}

function runMigrations(db: Database, migrations: Migration[]) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const current = db.prepare(
    'SELECT MAX(version) as v FROM schema_migrations'
  ).get()?.v ?? 0;

  for (const m of migrations.filter(x => x.version > current)) {
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(m.version);
    });
    tx();
  }
}
```

Future migrations (`002_...`) alter tables; never edit `001` after release.

---

## Repository pattern

Each repository receives `Database` in constructor.

```typescript
class TaskRepository {
  constructor(private db: Database) {}

  create(input: CreateTaskInput): Task { /* INSERT */ }
  update(id: string, patch: UpdateTaskPatch): Task { /* UPDATE */ }
  softDelete(id: string): void { /* set deleted_at */ }
  getById(id: string): Task | null { /* ... */ }
  list(filter: TaskFilter): TaskListItem[] { /* JOIN projects, tags */ }
}
```

**Transactions:** wrap multi-table updates (task + tags) in `db.transaction()`.

---

## Auth token storage

**Preferred:** Electron `safeStorage`

```typescript
import { safeStorage } from 'electron';

function saveTokens(tokens: OAuthTokens) {
  const json = JSON.stringify(tokens);
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(path.join(userData, 'auth.enc'), encrypted);
  } else {
    // fallback: warn user, store encrypted with app-specific key derived from machine id
  }
}
```

Never store tokens in SQLite (avoid accidental backup export exposure) or renderer localStorage.

---

## Backup and restore

**Manual backup** (Phase 12):

1. Pause sync worker
2. `VACUUM INTO 'backups/opentick-YYYYMMDD.db'`
3. Resume sync

**Restore:** replace db file while app stopped; run migrations on next start.

---

## Performance guidelines

| Scenario | Approach |
|----------|----------|
| Task list > 500 rows | Virtualized list (react-window) |
| Full-text search | Phase 2+: FTS5 virtual table on `title`, `content` |
| Bulk import sync | Batch inserts in transactions of 100 |
| N+1 tag loads | Single query with `GROUP_CONCAT` or secondary query by task ids |

---

## Dev seed data

Script `electron/main/db/seed.ts` (dev only):

- 3 projects (Work, Personal, + inbox flag on one)
- 20 tasks with varied due dates, priorities, 5 subtasks
- 4 tags

Gate with `if (process.env.NODE_ENV === 'development' && argv.includes('--seed'))`.

---

## Integrity rules

1. Cannot hard-delete project with pending tasks — soft-delete cascade or block
2. `parent_id` must share same `project_id` as parent task
3. Unique `remote_id` when not null — use upsert on inbound sync
4. Inbox project: at most one row with `is_inbox = 1`

---

## Testing

Use `:memory:` SQLite for unit tests:

```typescript
const db = new Database(':memory:');
runMigrations(db, migrations);
const repo = new TaskRepository(db);
```

For integration tests, copy fixture `.db` file to temp directory.
