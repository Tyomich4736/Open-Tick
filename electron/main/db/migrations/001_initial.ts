import type Database from 'better-sqlite3'

export const MIGRATION_001_SQL = `
CREATE TABLE IF NOT EXISTS projects (
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

CREATE INDEX IF NOT EXISTS idx_projects_remote_id ON projects(remote_id);
CREATE INDEX IF NOT EXISTS idx_projects_deleted ON projects(deleted_at);

CREATE TABLE IF NOT EXISTS tasks (
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
  sort_order          INTEGER NOT NULL DEFAULT 0,
  sync_status         TEXT NOT NULL DEFAULT 'synced',
  remote_updated_at   TEXT,
  completed_at        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_remote_id ON tasks(remote_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_sync ON tasks(sync_status);

CREATE TABLE IF NOT EXISTS tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  color       TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);

CREATE TABLE IF NOT EXISTS sync_queue (
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

CREATE INDEX IF NOT EXISTS idx_sync_queue_scheduled ON sync_queue(scheduled_at);

CREATE TABLE IF NOT EXISTS sync_state (
  id                         INTEGER PRIMARY KEY CHECK (id = 1),
  last_full_sync_at          TEXT,
  last_incremental_sync_at   TEXT,
  inbox_remote_id            TEXT,
  is_syncing                 INTEGER NOT NULL DEFAULT 0,
  last_error                 TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`

export const MIGRATION_001_SEED_SQL = `
INSERT OR IGNORE INTO sync_state (id) VALUES (1);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', '"system"'),
  ('timezone', '"system"'),
  ('week_starts_on', '1'),
  ('notifications_enabled', 'true'),
  ('notification_lead_minutes', '15'),
  ('sync_interval_minutes', '3'),
  ('minimize_to_tray', 'false');
`

export const migration001 = {
  version: 1,
  up(db: Database.Database): void {
    db.exec(MIGRATION_001_SQL)
    db.exec(MIGRATION_001_SEED_SQL)
  },
}
