# Data Model

Local entities extend TickTick remote fields with sync metadata. Types below are the **source of truth** for implementation in `shared/entities.ts`.

---

## ID strategy

| Field | Description |
|-------|-------------|
| `id` | Local UUID (v4), primary key in SQLite, stable for app lifetime |
| `remote_id` | TickTick server id; `NULL` until first successful push |
| `remote_project_id` | Denormalized for API calls requiring project scope |

**Rule:** UI and IPC always reference **local** `id`. Main process resolves `remote_id` when calling TickTick.

For new local-only tasks before sync:

1. Insert with `remote_id = NULL`, `sync_status = 'pending_create'`
2. After `POST /task`, set `remote_id` from response

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
  deleted_at: string | null;     // soft delete tombstone
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

**Delete behavior:** soft-deleting a folder sets `projects.folder_id = NULL` for its projects (ungroup). Projects are not deleted.

**Expand/collapse:** persisted in `settings.folder_expanded` as `Record<folderId, boolean>`.

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

Max **5** reminders per task. OS notification scheduling is Phase 11.

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
| `recurrence_rule` | TickTick repeat fields (Phase 12) |
| reminders | TickTick reminders (Phase 12) |

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
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` — **deprecated**; use `appearance.theme_mode` (Phase 5) |
| `timezone` | string (IANA) | OS timezone |
| `week_starts_on` | `0 \| 1` | `1` (Monday) |
| `calendar_day_start_hour` | number `0–23` | `0` |
| `calendar_day_end_hour` | number `1–24` | `24` |
| `calendar_show_all_recurrence` | boolean | `false` — when true, calendar expands future repeat cycles |
| `notifications_enabled` | boolean | `true` |
| `notification_lead_minutes` | number | `15` |
| `sync_interval_minutes` | number | `3` |
| `minimize_to_tray` | boolean | `false` |

**Layout keys (Phase 8)**

| Key | Type | Default |
|-----|------|---------|
| `layout.sidebar_width` | number | `240` |
| `layout.detail_width` | number | `400` |
| `layout.sidebar_collapsed` | boolean | `false` |

**Appearance keys (Phase 5)**

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

Migrate legacy `theme` → `appearance.theme_mode` on first read after Phase 5 migration.

---

## Entity: StickyNote (Phase 11)

Window state for task-bound desktop stickies. **Content lives on the task** (`tasks.content`, `tasks.title`) — this table only tracks window placement and pin state.

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

**Rules**

- Opening sticky for `task_id` creates row if missing; closing window deletes row (task remains)
- Description edits go through `TaskRepository.update` on `content`, not stored here
- On app launch, restore all `sticky_notes` rows as open `BrowserWindow` instances

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

**Duration overlap (Phase 10):** a task overlaps a day when `start_date ≤ end_of_day` AND `due_date ≥ start_of_day`. Point tasks (`start_date` null) use `due_date` only. Implement in `TaskRepository.list(filter: TaskFilter)`.

**Timestamp storage:** `due_date` / `start_date` are always canonical UTC ISO strings ending in `Z` so SQLite string compares are safe. Smart-list bounds also use UTC Z (`Date.toISOString()`), never `formatISO` local offsets.

**All-day (TickTick pull):** remote all-day values are midnight in the task `timeZone` (often encoded as the previous evening in UTC, e.g. `2026-09-20T21:00:00.000+0000` = 21 Sep 00:00 `Europe/Minsk`). On pull they are rewritten to **noon in that timezone** (UTC Z) so Today/Tomorrow match the calendar day the user sees. Locally created all-day tasks already use noon local via `combineLocalDateTime`.

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

## Mapper functions (main process)

Implement in `electron/main/ticktick/mappers/`:

- `remoteTaskToLocal(dto, projectLocalId, parentLocalId?) → Partial<Task>`
- `localTaskToRemote(task, projectRemoteId, parentRemoteId?) → TickTickTaskDto`
- `remoteProjectToLocal(dto) → Partial<Project>`
- `localProjectToRemote(project) → TickTickProjectDto`

**Timestamp rule:** On any local mutation, set `updated_at = now()` and `sync_status` to pending variant.

---

## Conflict detection

Compare on inbound merge:

1. If local `sync_status` is pending_* → **keep local**, retry push (local wins while dirty)
2. Else if `remote_updated_at > updated_at` → **apply remote**
3. Else if `updated_at > remote_updated_at` → **keep local**, enqueue update
4. If equal → no-op

Log case 3 when both changed since last sync for debugging.

---

## Deleted records

Use **soft deletes** (`deleted_at`) locally:

- Pending delete → push `DELETE` to API → hard delete local row after 204
- Inbound: if task missing from pull but exists locally synced → mark deleted locally

---

## TypeScript export layout

```
shared/
├── entities.ts      # interfaces above
├── ipc-types.ts     # request/response for each IPC channel
└── filters.ts       # TaskFilter, sort options
```

Both electron main and renderer import from `shared/` (no Node APIs in shared code).
