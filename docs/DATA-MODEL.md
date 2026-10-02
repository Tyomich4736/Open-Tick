# Data model

What we store locally, plus the sync fields TickTick doesn’t know about. Keep these shapes aligned with `shared/entities.ts`.

---

## IDs

| Field | Meaning |
|-------|---------|
| `id` | Local UUID — primary key, stable for the life of the row |
| `remote_id` | TickTick’s id; null until the first successful push |
| `remote_project_id` | Denormalized when an API call needs a project scope |

The UI and IPC only ever pass local `id`. Main looks up `remote_id` when talking to TickTick.

New local task: insert with `remote_id = NULL` and `sync_status = 'pending_create'`, then set `remote_id` from the `POST /task` response.

---

## Enums

```typescript
type SyncStatus =
  | 'synced'           // matches remote
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'conflict';        // needs resolution

type TaskStatus = 'pending' | 'completed';

type Priority = 0 | 1 | 3 | 5; // matches TickTick API

type ProjectViewMode = 'list' | 'kanban' | 'timeline';
```

Map API `status` int → local enum:

- `0` → `pending`
- `2` → `completed`

---

## Entity: Project

```typescript
interface Project {
  id: string;                    // local UUID
  remote_id: string | null;
  folder_id: string | null;      // FK → project_folders.id; NULL = top-level
  name: string;
  color: string;                 // #RRGGBB
  view_mode: ProjectViewMode;
  kind: string;                  // 'TASK'
  is_inbox: boolean;             // true for discovered inbox project
  sort_order: number;            // user-defined order within folder / top level
  sync_status: SyncStatus;
  remote_updated_at: string | null;  // ISO timestamp from last pull
  created_at: string;
  updated_at: string;
  deleted_at: string | null;     // soft delete until push confirms
}
```

### API mapping

| Local | Remote (TickTick) |
|-------|-------------------|
| `remote_id` | `id` |
| `folder_id` | resolve via folder `remote_id` / API project group |
| `name` | `name` |
| `color` | `color` |
| `view_mode` | `viewMode` |
| `kind` | `kind` |

---

## Entity: ProjectFolder

One-level nesting only: projects live in a folder; folders do not nest.

```typescript
interface ProjectFolder {
  id: string;                    // local UUID
  remote_id: string | null;
  name: string;
  sort_order: number;            // sidebar folder order
  sync_status: SyncStatus;
  remote_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

Deleting a folder only ungroups: `projects.folder_id` goes null. Projects stay. Folder open/closed state lives in `settings.folder_expanded`.

### API mapping

| Local | Remote (TickTick) |
|-------|-------------------|
| `remote_id` | folder `id` |
| `name` | `name` |
| `sort_order` | `sortOrder` |

---

## Entity: Task

```typescript
interface Task {
  id: string;
  remote_id: string | null;
  project_id: string;            // local FK → projects.id
  parent_id: string | null;    // local FK → tasks.id (subtasks)
  title: string;
  content: string;               // Markdown
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;       // ISO 8601
  start_date: string | null;
  is_all_day: boolean;
  time_zone: string | null;      // IANA
  recurrence_rule: RecurrenceRule | null;  // JSON RRULE-like
  recurrence_parent_id: string | null;     // series root / exceptions
  sort_order: number;
  sync_status: SyncStatus;
  remote_updated_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

### Reminders (local)

```typescript
interface TaskReminder {
  id: string;
  task_id: string;
  kind: 'before' | 'at_due' | 'after';
  offset_minutes: number;  // relative to due; 0 for at_due
  created_at: string;
}
```

Max 5 reminders per task. OS notifications are scheduled in the main process.

### Recurrence

`recurrence_rule` stores `{ frequency, interval, weekdays?, anchor, end, completed_count? }`.
Completing a recurring task marks it done and inserts the next pending instance (same title/tags/reminders) with advanced dates. `recurrence_edit_scope: 'this'` clears the rule on that row and sets `recurrence_parent_id`.

### API mapping

| Local | Remote |
|-------|--------|
| `remote_id` | `id` |
| `project_id` | resolve `projectId` via project's `remote_id` |
| `parent_id` | resolve `parentId` via parent's `remote_id` |
| `title` | `title` |
| `content` | `content` |
| `priority` | `priority` |
| `status` | `status` (0/2) |
| `due_date` | `dueDate` |
| `start_date` | `startDate` |
| `is_all_day` | `isAllDay` |
| `time_zone` | `timeZone` |
| `recurrence_rule` | TickTick repeat fields |
| reminders | TickTick reminders |

---

## Entity: Tag

Tags are normalized locally; API sends `string[]` on tasks.

```typescript
interface Tag {
  id: string;
  name: string;                  // unique, case-sensitive match to TickTick
  color: string | null;          // local-only UI enhancement
  created_at: string;
}

interface TaskTag {
  task_id: string;
  tag_id: string;
}
```

During push: collect tag names from `task_tags` join for API payload.
During pull: upsert tags by name, link to task.

---

## Entity: SyncQueueItem

```typescript
interface SyncQueueItem {
  id: string;
  entity_type: 'task' | 'project';
  entity_id: string;             // local id
  operation: 'create' | 'update' | 'delete' | 'complete';
  payload: string;               // JSON snapshot for retry
  attempts: number;
  last_error: string | null;
  created_at: string;
  scheduled_at: string;
}
```

---

## Entity: SyncState

Singleton row tracking global sync cursor.

```typescript
interface SyncState {
  id: 1;                         // single row
  last_full_sync_at: string | null;
  last_incremental_sync_at: string | null;
  inbox_remote_id: string | null;
  is_syncing: boolean;
  last_error: string | null;
}
```

---

## Entity: Settings

Key-value store for user preferences.

```typescript
interface Setting {
  key: string;
  value: string;                 // JSON-encoded
}
```

**Standard keys**

| Key | Type | Default |
|-----|------|---------|
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` — legacy; prefer `appearance.theme_mode` |
| `timezone` | string (IANA) | OS timezone |
| `week_starts_on` | `0 \| 1` | `1` (Monday) |
| `calendar_day_start_hour` | number `0–23` | `0` |
| `calendar_day_end_hour` | number `1–24` | `24` |
| `calendar_show_all_recurrence` | boolean | `false` — when true, calendar expands future repeat cycles |
| `notifications_enabled` | boolean | `true` |
| `notification_lead_minutes` | number | `15` |
| `sync_interval_minutes` | number | `3` |
| `minimize_to_tray` | boolean | `false` |

**Layout**

| Key | Type | Default |
|-----|------|---------|
| `layout.sidebar_width` | number | `240` |
| `layout.detail_width` | number | `400` |
| `layout.sidebar_collapsed` | boolean | `false` |

**Appearance**

| Key | Type | Default |
|-----|------|---------|
| `appearance.font_family` | string | `"-apple-system, Segoe UI, Roboto, sans-serif"` |
| `appearance.font_size` | number | `14` |
| `appearance.theme_mode` | `'light' \| 'dark' \| 'system'` | `'system'` |
| `appearance.theme_source` | `'preset' \| 'image' \| 'custom'` | `'preset'` |
| `appearance.preset_id` | string | `'default'` |
| `appearance.custom_colors` | `ThemeColors` | preset default tokens |
| `appearance.image_theme_path` | string \| null | `null` |
| `appearance.extracted_palette` | `ThemeColors` \| null | `null` |

```typescript
interface ThemeColors {
  bgPrimary: string;
  bgSidebar: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  border: string;
  priorityLow: string;
  priorityMedium: string;
  priorityHigh: string;
}
```

On read, map legacy `theme` → `appearance.theme_mode` if still present.

---

## Entity: StickyNote

Desktop sticky windows are just a view onto a task. Title and body live on `tasks`; this table is window placement and pin state.

```typescript
interface StickyNote {
  id: string;                    // local UUID
  task_id: string;               // FK → tasks.id (unique — one sticky window per task)
  window_x: number;
  window_y: number;
  width: number;
  height: number;
  is_pinned: boolean;            // alwaysOnTop
  is_collapsed: boolean;         // single-line title-only mode
  color: string | null;          // optional accent
  created_at: string;
  updated_at: string;
}
```

Open → create row if needed. Close window → delete the sticky row (task stays). Description edits go through `TaskRepository.update`. On launch, reopen every remaining sticky row.

---

### TaskListItem

Lightweight shape for list rendering:

```typescript
interface TaskListItem {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  is_all_day: boolean;
  project_id: string;
  project_name: string;
  project_color: string;
  tags: string[];
  subtask_count: number;
  completed_subtask_count: number;
}
```

### Smart list filters

| View | Query rule |
|------|------------|
| Inbox | `project.is_inbox = true` AND `status = pending` |
| Today | `status = pending` AND overlaps today (see below) |
| Tomorrow | overlaps tomorrow |
| Next 7 days | overlaps next 7 days |
| Overdue | `due_date < start_of_today` AND pending (point tasks); duration tasks where entire range ended before today |
| Completed | `status = completed`, sorted by `completed_at` DESC |

Duration overlap: a task hits a day when `start_date ≤ end_of_day` AND `due_date ≥ start_of_day`. Point tasks (`start_date` null) use `due_date` only — see `TaskRepository.list`.

Store `due_date` / `start_date` as UTC ISO ending in `Z` so string compares in SQLite are safe. Smart-list bounds should use the same (`Date.toISOString()`), not local-offset `formatISO`.

All-day from TickTick often arrives as midnight in the task timezone (which can look like the previous evening in UTC). On pull we rewrite to noon in that timezone so Today/Tomorrow match the calendar day. Locally created all-day tasks already use noon via `combineLocalDateTime`.

```typescript
interface TaskFilter {
  project_id?: string;
  smart_list?: 'inbox' | 'today' | 'tomorrow' | 'week' | 'overdue' | 'completed';
  status?: TaskStatus;
  tag?: string;
  search?: string;
  parent_id?: string | null;     // null = top-level only
  sort?: 'order' | 'due_date' | 'title' | 'priority';
  include_completed?: boolean;   // project / inbox; default false
}
```

Sort preference keys (settings): `list_sort.smart.<name>` / `list_sort.project.<id>`.  
Show-completed keys: `list_show_completed.smart.inbox` / `list_show_completed.project.<id>`.

---

## Mappers

Under `electron/main/ticktick/mappers/`:

- `remoteTaskToLocal` / `localTaskToRemote`
- `remoteProjectToLocal` / `localProjectToRemote`
- same idea for folders

Any local mutation bumps `updated_at` and sets a pending `sync_status`.

## Conflicts (inbound)

1. Local `pending_*` → keep local, push later
2. Remote newer → apply remote
3. Local newer while still “synced” → keep local, enqueue update
4. Equal → no-op

Log case 3 when both sides moved.

## Deletes

Soft-delete with `deleted_at`. After a successful remote `DELETE`, hard-delete the local row. If a synced task vanishes from a pull, mark it deleted locally.

## Shared types

```
shared/
├── entities.ts
├── ipc-types.ts
└── filters.ts
```

Main and renderer both import from here — no Node APIs in `shared/`.
