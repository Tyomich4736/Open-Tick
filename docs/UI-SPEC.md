# UI Specification

TickTick-inspired desktop UI. Prioritize clarity and keyboard efficiency over pixel-perfect clone.

---

## Layout

**List view (Phase 8)** — three-pane layout; task panel always present:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [App menu / title bar]                                                    │
├──────────┬─║─────────────────────────────║──────────────────────────────┤
│ SIDEBAR  ║  TASK LIST                    ║  TASK PANEL (always visible)  │
│ (resize) ║  (flex)                       ║  (resize)                     │
│          ║                               ║                               │
│ Inbox    ║  ☐ Task title        Aug 28  ║  [empty state OR]             │
│ Today    ║     #tag #tag               ║  Title                          │
│ ─────    ║  ☑ Done task      Yesterday ║  Description…                  │
│ ▼ Work   ║                               ║  Subtasks…                     │
│   List A ║                               ║                               │
│          ║                               ║                               │
│ ═══════  ║                               ║                               │
│ Settings │                               │                               │
└──────────┴─║─────────────────────────────║──────────────────────────────┘
             ↑ drag handles (║) between panels
```

**Empty task panel** (no selection):

```
┌─────────────────────────┐
│                         │
│     [illustration]      │
│  Select a task to view  │
│       details           │
│                         │
│      [+ Add task]       │
│                         │
└─────────────────────────┘
```

**Responsive behavior**

- Window min size: 900×600
- Sidebar: resizable 180–360px; collapsible to icons-only (64px) via toggle
- Task panel: resizable 280–560px; always shown in list view (empty or filled)
- Task list: flex column takes remaining space between sidebar and panel
- Below 900px width: enforce minimums; optional collapse task panel to two-pane (stretch)
- **Settings / Calendar**: replace or reflow main area — not the three-pane list layout

---

## Color and typography

Default tokens (overridden by **Appearance** settings in Phase 5):

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#FFFFFF` | `#1A1A1A` |
| `--bg-sidebar` | `#F7F7F7` | `#252525` |
| `--text-primary` | `#191919` | `#F0F0F0` |
| `--accent` | `#4772FA` | `#6B8AFF` |
| `--border` | `#E8E8E8` | `#333333` |

- Font: `--font-family` (default system UI stack)
- Base size: `--font-size-base` (default 14px); task title 15px medium

**Priority colors**

| Priority | Color |
|----------|-------|
| None | transparent |
| Low | `#4772FA` |
| Medium | `#FFAF38` |
| High | `#FE7777` |

---

## Sidebar sections

### Smart lists (fixed order)

1. **Inbox** — icon: inbox tray
2. **Today** — badge with count
3. **Tomorrow**
4. **Next 7 Days**
5. **Completed** (optional in MVP — can live under filter)

### Projects & folders

- Sorted by `sort_order`, then name
- Grouped under collapsible **folders** (Phase 4); top-level projects listed after folders
- Each row: color dot + name + task count (pending) + `⋮` on hover
- Footer: **+ New Project** / **+ New Folder**

### Sidebar context menus (Phase 8)

Right-click or `⋮` on any sidebar item:

**Smart list** (Inbox, Today, Tomorrow, Next 7 Days, Completed)

| Item | Behavior |
|------|----------|
| Add task | Create with list-appropriate defaults (Today → due today, etc.) |
| Clear all completed | Completed list only — delete all completed tasks (confirm) |

**Folder**

| Item | Behavior |
|------|----------|
| Add list | New project inside folder |
| Rename | Inline or dialog |
| Delete folder | Ungroup projects (confirm) |
| Expand / Collapse | Toggle folder open state |

**Project (list)**

| Item | Behavior |
|------|----------|
| Add task | Quick-add at top of list |
| Rename | Inline or dialog |
| Change color | Color picker submenu |
| Move to folder | Submenu: folders + top level |
| Duplicate list | Clone project + tasks (stretch) |
| Delete list | Confirm; option to delete or move tasks |

### Footer

- Sync indicator (dot: green/orange/red) — **click opens Integration panel** (Phase 13)
- Settings gear

---

## Task list (Phase 8 layout)

### Row contents

```
[checkbox] [priority bar]  Title                          [due chip]
                           [tag] [tag] …                    (optional ⋮)
                           2/5 subtasks                     (if any)
```

- **Line 1**: checkbox, priority bar (3px), title (medium weight), due date chip right-aligned
- **Line 2**: tags as small chips **below title** (left-indented past checkbox)
- **Line 3** (optional): subtask progress `2/5`

**States**

- Hover: subtle background + `⋮` menu button fades in
- Selected: accent left border
- Completed: strikethrough title, muted tags, checkbox checked with animation
- Overdue due chip: red text
- Dragging: lifted shadow ghost; drop indicator line between rows

### Interactions

| Action | Behavior |
|--------|----------|
| Click checkbox | Toggle complete (optimistic + animation) |
| Click row | Select task → fill right panel (single select; clears multi-select) |
| Ctrl+click row | Toggle task in multi-selection |
| Shift+click row | Range select from anchor to clicked task |
| Click empty list area | Deselect all → empty panel |
| Double-click title | Inline edit title |
| Right-click row | Open **context menu** (primary actions) |
| Click `⋮` | Same context menu |
| `Delete` key | Delete with confirm (or via menu) |
| Drag row/handle | Reorder within list; auto-scroll; drop indicator |
| `Cmd/Ctrl+Shift+O` | Open selected task in new window |

### Context menu (TickTick-style)

Right-click or `⋮` on a task row:

| Item | Behavior |
|------|----------|
| Date & reminder | Submenu: Today, Tomorrow, Next week, Pick date…, **Duration…**, Clear date |
| Priority | Submenu: None, Low, Medium, High |
| Tags | Submenu: toggle existing tags + "Manage tags…" |
| Move to list | Project/folder picker |
| Add subtask | Creates subtask, focuses inline add in panel |
| Duplicate | Clone task in same list |
| Open in new window | `task:openWindow` — full-window view |
| Open as sticky note | `sticky:open` — desktop sticky for this task (Phase 11) |
| Delete | Confirm dialog |
| Mark complete | Toggle if not using checkbox |

**Not in detail panel** — these live only in context menu (or read-only chips in panel).

### Multi-select (Phase 9)

- **Ctrl+click** / **Shift+click** to select multiple tasks
- List header shows `N selected` when count > 1
- Selected rows use distinct highlight

**Right panel with multi-select:**

| Selection count | Panel content |
|---------------|---------------|
| 0 | Empty state |
| 1 | Full task detail for that task |
| 2+ | Summary only: “N tasks selected” + hint to right-click; **never** multiple full editors |

**Bulk context menu** (right-click when 2+ selected): set date, priority, tags (add), move to list, complete, incomplete, delete.

### Quick add

- Input at top of list or floating `+`
- Placeholder: "Add task to Inbox" (context-aware)
- Enter → create; Shift+Enter → add with detail panel open

---

## Task detail panel (Phase 8 — persistent, slim)

**Always visible** in list view. Right column of three-pane layout (~400px default, resizable).

Content-focused. **Actions moved to context menu.**

**Empty state** (no selection, or selection cleared):

- Centered message: “Select a task to view details”
- Optional illustration; **+ Add task** button

**Multi-select state** (2+ tasks selected):

- `N tasks selected` heading
- Short hint: “Right-click for bulk actions”
- Optional truncated title list (read-only, max 5 items)
- **No** task editor fields

**Filled state** (exactly 1 task selected):

1. **Title** — single line, auto-focus on new task
2. **Metadata strip** (read-only chips): due date · priority dot · project — click opens relevant context menu section
3. **Description** — markdown editor (from Phase 7)
4. **Subtasks** — nested checklist with add field
5. **Reminder / repeat summary** — compact read-only line; edit via context menu or click to expand picker (stretch)

**Removed from panel** (context menu only): priority picker, tag editor, project dropdown, delete button, duplicate.

Auto-save on blur / debounced 500ms.

Show sync badge if `sync_status !== 'synced'`: "Pending sync…"

### Layout rules

- List view **always** renders sidebar + list + panel
- **Exactly one** task detail in panel; multi-select shows summary only
- Drag handle between list and panel resizes panel; width persisted
- **Settings** route replaces list layout (no three-pane); user returns via sidebar
- **Integration panel** slides over from right; list layout remains underneath (optional dim)
- Full-window task (`Cmd/Ctrl+Shift+O`) is separate window — does not hide main panel

---

## Resizable panels (Phase 8)

| Divider | Resizes | Range | Persisted key |
|---------|---------|-------|---------------|
| Sidebar ↔ list | Sidebar width | 180–360px (64px collapsed) | `layout.sidebar_width` |
| List ↔ panel | Task panel width | 280–560px | `layout.detail_width` |

- Drag handle: 4px hit area, `col-resize` cursor, subtle highlight on hover
- Double-click divider: reset to default width
- Sidebar collapse button: icons-only mode, independent of width setting

---

## Full-window task view (Phase 8)

Separate window for focused editing — same slim layout, more space for description.

```
┌─ Buy groceries ─────────────────────────────── [×] ┐
│  Title                                            │
│  ─────────────────────────────────────────────    │
│  Due: Today · Medium · Inbox                      │
│  ─────────────────────────────────────────────    │
│  Markdown description (large editor area)         │
│                                                   │
│  Subtasks                                         │
│  ☐ Milk                                           │
│  ☐ Eggs                                           │
└───────────────────────────────────────────────────┘
```

- Open: context menu → "Open in new window" or `Cmd/Ctrl+Shift+O`
- Platform-native title bar; min size 500×600
- Right-click in window still shows task context menu
- Changes persist to SQLite; main window list updates live

---

## Animations (Phase 8)

| Element | Animation | Duration |
|---------|-----------|----------|
| Detail panel content | Cross-fade on task change | 150ms |
| Panel resize | None during drag | — |
| Task complete | Checkbox scale + row opacity | 150ms |
| Row insert/remove | Height + opacity | 200ms |
| Drag ghost | Follow cursor, slight scale | instant |
| List drop | Reflow with transition | 200ms |

Honor `prefers-reduced-motion: reduce` — set durations to 0 or skip transforms.

---

## Calendar view (Phase 10)

### Views

- Month grid, Mon–Sun header (respect `week_starts_on`)
- Dots under date for task count (includes duration tasks spanning that day)
- Week view: hourly grid + all-day row at top
- Day view: single-day hourly agenda
- Agenda view: scrollable upcoming tasks
- Click date → day agenda list below or beside (month view)
- Tasks draggable between dates (updates range or `due_date` locally)

### Duration tasks

A duration task has `start_date` and `due_date` (end). Distinct from a single due datetime.

**Create / edit**

| Entry point | Behavior |
|-------------|----------|
| Context menu → Date & reminder → **Duration** | Picker with start date/time + end date/time |
| All-day toggle in duration picker | Multi-day span (no times); renders in all-day row |
| Week/day grid click-drag | New task with time range = selection; title prompt in panel |
| Task panel metadata strip | Shows `Start – End`; click opens duration picker |

**Display**

| View | Duration rendering |
|------|-------------------|
| Month | Bar or dots on each day the range touches; all-day row for all-day spans |
| Week/day | Block from start hour to end hour; height ∝ duration |
| List due chip | `10:00–12:00` same day, or `Aug 28 – Aug 30` multi-day |

**Smart list overlap rule**: Today includes tasks where `start_date ≤ end of today` AND `due_date ≥ start of today`.

**Validation**: end ≥ start; error toast if user picks invalid range.

---

## Sticky notes (Phase 11)

Task-bound desktop windows matching TickTick — pin a task, edit its description, keep on top, move freely.

```
┌─ Buy groceries ─────────────── [📌] [×] ┐  ← drag title bar to move
│ ☐ Buy groceries                        │
│ ─────────────────────────────────────  │
│ Markdown description editor            │
│ - Milk                                 │
│ - Eggs                                 │
│                                        │
└────────────────────────────────── ◢ ──┘  ← resize handle
```

### Behavior

| Action | How |
|--------|-----|
| **Create** | Task context menu → “Open as sticky note” |
| **Edit description** | Type in sticky body — same markdown editor as task panel; saves to `tasks.content` |
| **Edit title** | Click title in sticky header |
| **Pin** | Pin button or `F12` → `alwaysOnTop` on window |
| **Move** | Drag title bar; position persisted |
| **Resize** | Drag bottom-right corner |
| **Close** | `×` closes sticky only; task unchanged |
| **Collapse** | Double-click title bar → single-line mode (stretch) |

### Sync with main app

- Sticky reads/writes `task.title` + `task.content` — not a separate note body
- Changes in sticky appear in main task panel/list immediately
- Changes in main app update open sticky via `sync:changed`

### Context menu addition (Phase 11)

Add to task context menu:

| Item | Behavior |
|------|----------|
| Open as sticky note | Open/focus sticky window for this task |

---

## Integration panel (Phase 13–15)

Slide-over panel (right side, ~360px) for TickTick sync status and controls. Distinct from Settings — optimized for at-a-glance monitoring.

**Phase 13:** connection, last pull, pull progress, **Pull now** — no pending-push UI.
**Phase 14+:** pending push breakdown, Sync now = pull + push.
**Phase 15:** conflicts, auto-sync interval, expandable history.

```
┌─ Integration ───────────────────────────── [×] ┐
│  ● Connected as user@example.com               │
│                                                │
│  Status          Idle                          │
│  Last pulled     2 minutes ago                 │
│                  Aug 28, 2026 10:42 AM         │
│                                                │
│  Pending push    3 changes          (Phase 14) │
│    Tasks         2                             │
│    Projects      1                             │
│    Folders       0                             │
│                                                │
│  [  Pull now / Sync now  ]                     │
│                                                │
│  ── Recent activity ──────────────────────     │
│  ✓ Pull completed · 12 pulled                  │
│  ✗ Pull failed · Network error · 9:15 AM       │
│  … View full log                               │
└────────────────────────────────────────────────┘
```

**States**

| Sync state | Footer dot | Panel header |
|------------|------------|--------------|
| Synced, idle | Green | "Up to date" |
| Pending local changes (Phase 14+) | Orange | "N changes to push" |
| Syncing / Pulling | Blue pulse | Progress line + bar |
| Error | Red | Error message + Retry |
| Not connected | Gray | Connect CTA |
| Offline | Gray | "Offline" (Phase 14+: "changes queued") |

**Interactions**

| Action | Behavior |
|--------|----------|
| Click footer sync chip | Toggle Integration panel |
| `Cmd/Ctrl+Shift+S` | Open panel + start pull (13) / sync (14+) if connected |
| Pull now / Sync now | `sync:now` IPC; disable while `isSyncing` |
| View full log | Expand inline list or navigate to Settings → Integration |

Auto-refresh panel while open via `sync:status-changed` and `sync:progress` events.

---

## Settings screen

Tabs:

### Account

- Connect / Disconnect TickTick
- Link: **Open Integration panel** for sync details

### General

- Timezone (IANA select)
- Time format / list density

### Calendar

- Week starts on Monday/Sunday
- Visible hours for timed grids (from / to)

### Appearance (Phase 5)

Dedicated tab for look and feel.

**Font**

- Family: preset dropdown (System, Inter, Segoe UI, Georgia, JetBrains Mono, …) + custom CSS string (advanced)
- Size: slider 12–20px with live preview sample

**Theme source** (radio: Preset · From image · Custom colors)

| Mode | UI |
|------|-----|
| **Preset** | Grid of theme cards (Default, Midnight, Paper, …); each shows mini sidebar + list preview |
| **From image** | Upload/drop image → auto-extract palette → preview; optional re-pick image |
| **Custom colors** | Color pickers: background, sidebar, text, accent, border; contrast hint if ratio low |

- **Theme mode**: Light / Dark / System (applies on top of chosen palette)
- **Reset** button restores default preset
- Changes apply instantly across app (CSS variables on `:root`)

### Notifications

- Enable reminders
- Lead time (5 / 15 / 30 / 60 min)

### Integration (Phase 13–15)

- Auto-sync interval (Phase 15: 2 / 5 / 15 min, manual only)
- Sync on app focus (Phase 15)
- Full sync log table (errors, conflicts) — duplicates panel “View full log” (Phase 15)
- Phase 13: pull status only; Phase 14: pending push prefs if any

### About

- Version, open logs folder

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+N` | New task in current list |
| `Cmd/Ctrl+K` | Command palette / quick find |
| `Cmd/Ctrl+,` | Settings |
| `Cmd/Ctrl+1..9` | Jump smart lists (optional) |
| `Cmd/Ctrl+A` | Select all tasks in current list (stretch) |
| `Esc` | Clear selection / close overlay |
| `Space` | Toggle complete (when task focused) |
| `Delete` | Delete selected task |
| `Cmd/Ctrl+Shift+O` | Open selected task in new window |
| `Cmd/Ctrl+Shift+S` | Open Integration panel / Sync now |

Register global shortcut for quick capture (Phase 12): `Cmd/Ctrl+Shift+Space`.

---

## Empty states

| View | Message |
|------|---------|
| Inbox empty | "Inbox zero — nice work!" |
| Today empty | "No tasks due today" |
| Project empty | "No tasks in {name}. Add one above." |
| Not connected | "Connect TickTick to sync across devices" CTA |

---

## Component inventory

```
components/
├── layout/
│   ├── AppShell.tsx
│   ├── Sidebar.tsx
│   ├── SidebarItem.tsx
│   ├── SidebarContextMenu.tsx
│   ├── ResizeHandle.tsx
│   ├── TaskPanel.tsx
│   └── StatusBar.tsx
├── tasks/
│   ├── TaskList.tsx
│   ├── TaskRow.tsx
│   ├── TaskDetail.tsx
│   ├── TaskContextMenu.tsx
│   ├── BulkTaskContextMenu.tsx
│   ├── TaskPanelMultiSelect.tsx
│   ├── TaskWindow.tsx
│   ├── StickyNoteWindow.tsx
│   ├── QuickAdd.tsx
│   ├── SubtaskList.tsx
│   ├── PriorityPicker.tsx
│   ├── DueDatePicker.tsx
│   └── TagInput.tsx
├── projects/
│   ├── ProjectList.tsx
│   └── ProjectFormModal.tsx
├── calendar/
│   ├── ViewModeSwitcher.tsx
│   ├── CalendarMonth.tsx
│   ├── CalendarTimeGrid.tsx
│   └── CalendarAgenda.tsx
├── settings/
│   ├── SettingsPage.tsx
│   ├── AccountTab.tsx
│   ├── AppearanceTab.tsx
│   └── IntegrationTab.tsx
├── appearance/
│   ├── ThemeProvider.tsx
│   ├── FontPicker.tsx
│   ├── PresetThemeGrid.tsx
│   ├── ImageThemePicker.tsx
│   └── CustomColorEditor.tsx
├── integration/
│   ├── IntegrationPanel.tsx
│   ├── SyncStatusCard.tsx
│   ├── PendingChangesBreakdown.tsx
│   └── SyncActivityList.tsx
└── ui/                    # shadcn primitives
    ├── button, input, checkbox, dialog, ...
```

---

## Accessibility

- All interactive elements keyboard-focusable
- Checkbox has `aria-label="Mark complete: {title}"`
- Color not sole indicator of priority (use icons/labels)
- Respect `prefers-reduced-motion`

---

## Reference screenshots (implementation)

When implementing, compare against official TickTick desktop app for:

- Sidebar density and iconography
- Today list grouping (optional: group by project)
- Date chip formatting: "Today", "Tomorrow", "Aug 28"

Do **not** copy proprietary assets — use Lucide icons and original branding name.
