# Implementation Guide

This document is written for **future implementation sessions** (human or AI). Follow it sequentially unless explicitly scoped to a single phase.

---

## Before writing code

1. Read [ROADMAP.md](./ROADMAP.md) — confirm current phase
2. Read the phase-specific docs linked in that phase
3. Do not skip local-first architecture — **no direct API calls from renderer**

---

## Phase 0 checklist — Bootstrap

### 0.1 Scaffold

```bash
npm create @electron-vite/create@latest . -- --template react-ts
```

Adjust `electron.vite.config.ts`:

- `shared/` alias for both main and renderer
- Externalize `better-sqlite3` in main build (native module)

### 0.2 BrowserWindow hardening

In `electron/main/index.ts`:

```typescript
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: false, // required for some preload patterns; keep preload minimal
}
```

### 0.3 Preload API surface

Start minimal in `electron/preload/index.ts`:

```typescript
contextBridge.exposeInMainWorld('ticktick', {
  ping: () => ipcRenderer.invoke('app:ping'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
});
```

Add typed wrapper in `src/lib/ipc-client.ts` matching `shared/ipc-types.ts`.

### 0.4 Layout shell

Implement `AppShell` with placeholder sidebar routes — no data yet.

**Done when:** dev window opens, HMR works, typed IPC ping returns.

---

## Phase 1 checklist — Database

### 1.1 Database singleton

- `electron/main/db/connection.ts` — open DB at `userData/ticktick.db`
- Run migrations on app ready **before** creating window

### 1.2 Migration 001

Copy SQL from [LOCAL-STORAGE.md](./LOCAL-STORAGE.md) verbatim.

### 1.3 Repositories

Implement in order:

1. `SettingsRepository`
2. `ProjectRepository`
3. `TagRepository`
4. `TaskRepository`

Each method returns plain objects (not class instances).

### 1.4 IPC handlers

Register in `electron/main/ipc/registerHandlers.ts`:

- Wire each repository method to a channel
- Wrap in try/catch → normalized error response

### 1.5 Change notifications

After mutating writes, emit:

```typescript
mainWindow.webContents.send('sync:changed', { entityType: 'task', entityId: id, reason: 'local' });
```

**Done when:** renderer can create/list tasks via IPC; data persists restart.

---

## Phase 2 checklist — Core UI

### 2.1 TanStack Query setup

```typescript
// src/main.tsx
const queryClient = new QueryClient();

// hooks/useTasks.ts
export function useTasks(filter: TaskFilter) {
  return useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => ipc.tasks.list(filter),
  });
}
```

Subscribe to `sync:changed` → `queryClient.invalidateQueries({ queryKey: ['tasks'] })`.

### 2.2 Build views in order

1. Project list in sidebar (static smart lists first)
2. `TaskList` + `TaskRow`
3. `QuickAdd`
4. `TaskDetail` panel
5. Project create/edit modal

### 2.3 Optimistic updates

For complete toggle:

```typescript
useMutation({
  mutationFn: (id) => ipc.tasks.complete(id),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['tasks'] });
    // snapshot + optimistic patch
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
});
```

**Done when:** full offline CRUD from UI.

---

## Phase 3 checklist — OAuth

### 3.1 Token service

`electron/main/ticktick/TokenService.ts`:

- load/save encrypted tokens
- `getValidAccessToken()` with refresh logic

### 3.2 OAuth flow

`electron/main/ticktick/oauth.ts`:

- `startOAuthFlow()` → returns Promise<tokens>
- loopback server on configurable port

### 3.3 Settings UI

Account tab with Connect button → `ipc.auth.connect()`.

**Done when:** access token stored; Settings shows "Connected as …". **Do not** call `runFullPull()` yet — sync starts in Phase 13.

---

## Phase 4 checklist — Project Folders ✅

Follow [ROADMAP.md](./ROADMAP.md) Phase 4: `ProjectFolder` entity, repository, sidebar UI, drag-and-drop grouping.

**Done when:** folders and project assignment work fully offline.

---

## Phase 5 checklist — Appearance & UI Settings ✅

### 5.1 Theme provider

- `ThemeProvider` / `AppearanceProvider` reads appearance keys from settings on mount
- Inject CSS variables on `document.documentElement`
- Re-apply after save and on OS color-scheme change

### 5.2 Font settings

- Font family + size controls in `AppearanceSettings.tsx`
- Persist `appearance.font_family`, `appearance.font_size`

### 5.3 Theme modes

- Preset grid with 6 built-in palettes
- Image picker: file dialog → copy to `userData/themes/` → extract colors via Electron `nativeImage`
- Custom color editor with WCAG contrast hint

### 5.4 Migration

- Map legacy `theme` setting → `appearance.theme_mode` in migration 003

**Done when:** font and all three theme sources apply live and persist across restart.

---

## Phase 6 checklist — Smart Lists & Sorting ✅

- Overdue route + sidebar badge
- `TaskFilter.sort` + overdue-first due-date ordering in `TaskRepository`
- Sort picker + per-list settings persistence
- Show/hide completed on Inbox and project lists
- Per-view empty states

**Done when:** sorting and smart lists work fully offline.

---

## Phase 7 checklist — Rich Tasks ✅

- Migration `004_rich_tasks`: `task_reminders`, `recurrence_rule`, `recurrence_parent_id`
- Markdown edit/preview in `TaskDetailPanel` (`TipTap` WYSIWYG, stored as markdown)
- Up to 5 reminders with presets; end-time chip when start+due set
- Recurrence presets/custom (interval, weekdays, anchor, ends); complete → next instance
- Edit scope: this occurrence only vs all future

**Done when:** markdown, reminders, and recurrence work fully offline (no OS notifications yet).

---

## Phase 8–12 — offline features

UI polish, multi-select, calendar, sticky notes, desktop polish — follow [ROADMAP.md](./ROADMAP.md) Phases 8–12.

---

## Phase 10 checklist — Calendar Views ✅

### 10.1 Shell & data

- [x] `TaskFilter.due_from` / `due_to` with duration-aware overlap SQL
- [x] Smart lists Today / Tomorrow / Week use range overlap
- [x] `TaskListItem.start_date`; list due chip via `formatDueRange`
- [x] Settings: timezone + week starts on; calendar respects `week_starts_on`

### 10.2 Views

- [x] List ↔ Calendar switcher (`ViewModeSwitcher`)
- [x] Month / Week / Day / Agenda (`CalendarPage` + components)
- [x] Week/day time grid with all-day row; drag-create timed duration tasks
- [x] Date picker **Time** vs **Duration** mode (`DateTimeReminderField`)

### Stretch (deferred)

- [x] Show all repeat cycles on calendar (Settings → Calendar checkbox)
- [ ] Drag to reschedule / resize on grid
- [ ] Month multi-day drag-create

**Done when:** calendar views + duration create/edit work offline.

---

## Phase 8 checklist — UI Polish ✅

### 8.1 Task list layout

- [x] Redesign `TaskRow`: title line + tags on second line
- [x] Polish spacing, hover, selected states

### 8.2 Drag & drop

- [x] Drop indicator, drag ghost, auto-scroll in `TaskList`
- [x] Use `@dnd-kit` or existing DnD with animation on settle

### 8.3 Context menu

- [x] `TaskContextMenu.tsx` with date, priority, tags, move, delete, open window
- [x] Wire right-click + `⋮` button on row
- [x] Remove action controls from `TaskDetail.tsx`

### 8.4 Persistent task panel

- [x] `TaskPanel.tsx` always rendered in list view route
- [x] `TaskPanelEmpty.tsx` when no single-task selection
- [x] Selection state in Zustand; click row sets id, click away clears

### 8.5 Resizable panels

- [x] `ResizeHandle.tsx` between sidebar/list and list/panel
- [x] Persist `layout.sidebar_width`, `layout.detail_width`, `layout.sidebar_collapsed`

### 8.6 Sidebar context menus

- [x] `SidebarContextMenu.tsx` — smart list, folder, project variants
- [x] Wire right-click + `⋮` on `SidebarItem`

### 8.7 Slim detail panel

- [x] Panel: title, metadata chips, markdown body, subtasks only

### 8.8 Full-window task

- [x] `electron/main/windows/taskWindow.ts` — secondary `BrowserWindow`
- [x] IPC `task:openWindow` / `task:closeWindow`

### 8.9 Animations

- [x] Framer Motion or CSS transitions; `prefers-reduced-motion` guard

**Done when:** three-pane list layout with persistent panel, resizable dividers, task + sidebar context menus, full window work.

---

## Phase 9 checklist — Multi-Select & Bulk Operations

### 9.1 Selection model

- [x] `taskSelectionStore` in Zustand: `selectedIds`, `anchorId`, range select on Shift+click
- [x] Ctrl+click toggles; plain click single-selects and clears multi-select
- [x] List header `N selected` badge

### 9.2 Panel rules

- [x] `TaskPanelMultiSelect.tsx` when `selectedIds.length > 1` — summary only, no editors
- [x] `TaskDetailPanel` only when `selectedIds.length === 1` (or 0 → empty)
- [x] `TaskPanelEmpty` when `selectedIds.length === 0`

### 9.3 Bulk context menu

- [x] `BulkTaskContextMenu.tsx`: date, priority, tags (add), move, complete, delete
- [x] IPC `task:bulkUpdate`, `task:bulkDelete`, `task:bulkComplete` in main process
- [x] Transaction + toast summaries

**Done when:** Ctrl/Shift multi-select, bulk right-click actions, panel never shows more than one task editor.

---

## Phase 11 checklist — Sticky Notes

### 11.1 Schema & windows

- [x] Migration `005_sticky_notes` table per [DATA-MODEL.md](./DATA-MODEL.md)
- [x] `electron/main/windows/stickyNoteWindow.ts` — one `BrowserWindow` per pinned task

### 11.2 Task-bound editor

- [x] `StickyNoteWindow.tsx`: title + markdown body bound to `task.title` / `task.content`
- [x] Debounced save via existing `task:update` IPC
- [x] `sync:changed` listener to refresh when main app edits same task

### 11.3 Pin, move, resize

- [x] Title bar drag → `setPosition`; persist via `sticky:updateBounds`
- [x] Pin button + `F12` → `setAlwaysOnTop(is_pinned)`
- [x] Resize handle → persist width/height

### 11.4 Entry points

- [x] “Open as sticky note” in `TaskContextMenu.tsx`
- [x] Re-focus existing window if sticky already open for task

**Done when:** pin task → edit description in sticky → pin on top → drag anywhere; edits sync to main app.

---

## Phase 12 checklist — Desktop Polish & Offline Hardening

### 12.1 Settings

- [x] Settings tabs: **Desktop** + **Notifications**
- [x] Keys: `notifications_enabled`, `notification_lead_minutes`, `minimize_to_tray`, `desktop.auto_start`, shortcuts, `sticky.pin_by_default`
- [x] Backup export / restore actions on Desktop tab

### 12.2 Window, tray, shortcuts

- [x] Persist window bounds + maximized (`window.bounds` / `window.maximized`)
- [x] Close → tray when `minimize_to_tray`; auto-start via `app.setLoginItemSettings`
- [x] System tray: Show/Hide, Quick Add, New Sticky, Quit
- [x] Global shortcuts → quick capture + new sticky
- [x] Frameless quick-capture window (`/quick-capture`) → Inbox task

### 12.3 Reminders

- [x] Migration: `task_reminders.last_notified_at`
- [x] Main-process scheduler + Electron `Notification`; click focuses task

### 12.4 Search & performance

- [x] Migration `007`: FTS5 `tasks_fts` + triggers; `TaskRepository` uses `MATCH`
- [x] Command palette `Ctrl/Cmd+K`
- [x] Virtualize large `TaskList` with `@tanstack/react-virtual`

### 12.5 Backup

- [x] IPC `backup:export` (`VACUUM INTO`) / `backup:restore` (replace DB + relaunch)

**Done when:** tray + reminders + quick capture + FTS palette + backup work offline (offline MVP).

---

## Phase 13 checklist — Initial Pull

### 13.1 TickTickClient (read)

- [x] GET `/project`, `/project/group`, `/project/{id}/data`, `/project/inbox/data`
- [x] Auth header, 401 refresh retry, 429/5xx backoff

### 13.2 Mappers (inbound)

- [x] `remoteFolderToLocal`, `remoteProjectToLocal`, `remoteTaskToLocal`
- [x] Reminders (`TRIGGER:…`) + RRULE → local recurrence
- [x] Unit tests in `tests/unit/sync/mappers.test.ts`

### 13.3 SyncEngine — pull only

- [x] `runFullPull()` — folders → projects → inbox → per-project data
- [x] Skip dirty local rows (`sync_status != synced`)
- [x] No outbound API writes

### 13.4 Pull on connect + credentials UI

- [x] Settings → Account: user-fillable Client ID / Secret / region / redirect / scopes / optional PAT
- [x] After OAuth connect → background `runFullPull()`

### 13.5 Integration panel (pull-focused)

- [x] `SyncStatusDto` + IPC `sync:getStatus`, `sync:now`
- [x] Events `sync:status-changed`, `sync:progress`
- [x] `IntegrationPanel.tsx` + footer sync chip; `Ctrl/Cmd+Shift+S`

**Done when:** connect → pull → sidebar matches TickTick; spot-check tasks; **zero** outbound API writes.

---

## Phase 14 checklist — Outbound Push

### 14.1 OutboundQueue

On repository write paths, call `queue.enqueue(...)`.

Replace direct repository calls in IPC handlers with a **service layer** (`TaskService`) that:

1. Writes DB
2. Enqueues sync
3. Emits change event

### 14.2 Mappers (outbound)

`localTaskToRemote`, project/folder → API DTOs — unit test each.

### 14.3 SyncEngine — push

Drain queue after pull or on `sync:now`; process create/update/delete; soft-delete until confirmed.

### 14.4 Integration panel (push)

- Live pending push counts + breakdown
- Footer "N to push"; Sync now = pull + push

**Done when:** task created in app appears in TickTick web after sync; panel pending counts clear; vice versa still works via pull.

---

## Phase 15+ — follow ROADMAP

Incremental sync, conflicts, release hardening — specs in linked docs.

---

## File creation order (summary)

```
1.  shared/entities.ts
2.  shared/ipc-types.ts
3.  electron/main/db/migrations/001_initial.sql
4.  electron/main/db/connection.ts
5.  electron/main/db/repositories/*
6.  electron/main/ipc/handlers/*
7.  electron/preload/index.ts
8.  src/lib/ipc-client.ts
9.  src/components/layout/*
10. src/hooks/*
11. electron/main/ticktick/*
12. electron/main/sync/*
```

---

## IPC types template

```typescript
// shared/ipc-types.ts
export interface IpcResult<T> {
  ok: true;
  data: T;
} | {
  ok: false;
  error: { code: string; message: string };
}

export interface CreateTaskRequest {
  title: string;
  project_id: string;
  due_date?: string | null;
  priority?: Priority;
}

export interface TickTickApi {
  tasks: {
    list(filter: TaskFilter): Promise<IpcResult<TaskListItem[]>>;
    create(req: CreateTaskRequest): Promise<IpcResult<Task>>;
    // ...
  };
  auth: {
    connect(): Promise<IpcResult<void>>;
    status(): Promise<IpcResult<AuthStatus>>;
  };
}
```

---

## Common mistakes to avoid

| Mistake | Correct approach |
|---------|------------------|
| SQLite in renderer | Main process only |
| Store OAuth token in React state persist | Encrypted file in main |
| Use remote_id in UI keys | Local UUID always |
| Full sync on every keystroke | Debounce; queue updates |
| Hard delete tasks immediately | Soft delete until push confirms |
| Block UI during sync | Background worker + status indicator |

---

## Verification script (manual QA)

**After Phase 12 (offline MVP):**

- [ ] Fresh install → create projects, folders, tasks with no account
- [ ] Change font and theme (preset, image, custom) — persists across restart
- [ ] Task list: tags below title; context menu sets date/priority/tags/move/delete
- [ ] List view: task panel always visible; empty state when nothing selected
- [ ] Ctrl+Shift multi-select → bulk context menu applies to all; panel shows summary only
- [ ] Exactly one task selected → full detail in panel (never two editors)
- [ ] Resize sidebar and task panel; widths persist
- [ ] Right-click smart list, folder, and project shows context menu
- [ ] Settings open → list layout hidden; return via sidebar restores three-pane
- [ ] Open task in new window; edits sync to main list
- [ ] Today / calendar / reminders / recurrence all work offline
- [ ] Pin task as sticky; edit description in sticky; pin stays on top; drag to move
- [ ] Sticky description edits appear in main app task panel
- [ ] Sticky notes persist position across restart
- [ ] Search finds tasks by title and body
- [ ] Export and restore DB backup

**After Phase 13 (initial pull):**

- [ ] Connect account → pull populates sidebar with TickTick folders/projects/tasks
- [ ] Spot-check: titles, markdown body, dates, priority, tags, reminders, recurrence match TickTick
- [ ] Integration panel shows last pull time and live pull progress
- [ ] "Pull now" re-fetches without sending local creates/updates to TickTick
- [ ] Devtools / logs: no outbound POST/PUT/DELETE to TickTick API
- [ ] Disconnect → panel shows "Not connected"; app still works offline
- [ ] Reconnect + pull → no duplicate projects/tasks

**After Phase 14 (outbound push):**

- [ ] Create task locally → panel shows +1 pending → sync → count clears
- [ ] Create task locally → appears in TickTick web
- [ ] Complete / delete task locally → synced remotely
- [ ] Move task between projects → appears in correct list remotely

**After Phase 15:**

- [ ] Edit in TickTick web → appears after sync interval
- [ ] Conflicts logged and reflected in Integration panel

---

## When specs disagree with API reality

TickTick's public docs are sparse. During implementation:

1. Log raw API responses (dev only)
2. Update [TICKTICK-API.md](./TICKTICK-API.md) with discovered fields
3. Update mappers and [DATA-MODEL.md](./DATA-MODEL.md) if needed
4. Note changes in commit message

---

## Estimated effort

| Phase | Hours (solo dev) |
|-------|------------------|
| 0 | 4–8 |
| 1 | 12–16 |
| 2 | 20–30 |
| 3 | 8–12 |
| 4 | 8–12 |
| 5 | 12–16 |
| 6 | 8–12 |
| 7 | 20–30 |
| 8 | 16–24 |
| 9 | 10–14 |
| 10 | 16–24 |
| 11 | 12–16 |
| 12 | 16–24 |
| 13 | 24–40 |
| 14 | 16–24 |
| 15 | 16–32 |

**Offline MVP (Phases 0–12):** ~175–255 hours  
**Full v1 with sync (Phases 0–15):** ~235–335 hours

---

## Next action

Start **Phase 0** using [DEVELOPMENT.md](./DEVELOPMENT.md) setup commands, then proceed to Phase 1 migrations.
