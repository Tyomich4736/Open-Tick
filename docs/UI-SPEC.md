# UI spec

Desktop UI inspired by TickTick. Clarity and keyboard use matter more than being a pixel clone. Don’t ship TickTick’s assets — Lucide + our own branding.

---

## Layout

Three panes in list view: sidebar | task list | task panel. The panel is always there (empty or filled).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [App menu / title bar]                                                    │
├──────────┬─║─────────────────────────────║──────────────────────────────┤
│ SIDEBAR  ║  TASK LIST                    ║  TASK PANEL                   │
│ (resize) ║  (flex)                       ║  (resize)                     │
│ Inbox    ║  ☐ Task title        Aug 28  ║  empty state OR detail        │
│ Today    ║     #tag #tag               ║                                │
│ ▼ Work   ║                               ║                                │
│   List A ║                               ║                                │
│ Settings │                               │                                │
└──────────┴─║─────────────────────────────║──────────────────────────────┘
             ↑ drag handles between panels
```

Empty panel: “Select a task to view details” plus a way to add a task.

- Min window ~900×600
- Sidebar 180–360px (icons-only ~64px when collapsed)
- Panel 280–560px
- Settings / Integration replace or overlay this layout — they aren’t a fourth column in the three-pane view

---

## Color & type

Defaults (Appearance settings can override):

| Token | Light | Dark |
|-------|-------|------|
| `--bg-primary` | `#FFFFFF` | `#1A1A1A` |
| `--bg-sidebar` | `#F7F7F7` | `#252525` |
| `--text-primary` | `#191919` | `#F0F0F0` |
| `--accent` | `#4772FA` | `#6B8AFF` |
| `--border` | `#E8E8E8` | `#333333` |

Font via `--font-family` (system UI by default), base ~14px, titles ~15px medium.

Priority accents: none = no bar, low `#4772FA`, medium `#FFAF38`, high `#FE7777`. Don’t rely on color alone — menu labels still say Low/Medium/High.

---

## Sidebar

Smart lists in order: Inbox, Today (due today + overdue; count badge), Tomorrow, Next 7 Days, Overdue, Completed.

Projects sorted by `sort_order`, then name, nested under folders. Row: color dot, name, pending count, `⋮` on hover. Footer: new project / folder. Sync chip in the footer opens the Integration panel.

### Context menus

**Smart list** — Add task (with sensible defaults: Today → due today, etc.). Completed may get “Clear all completed” later.

**Folder** — Add list, rename, delete (ungroups lists), expand/collapse.

**Project** — Add task, rename, change color, move to folder, delete (confirm). Duplicate list is optional.

---

## Task list

```
[checkbox] [priority]  Title                          [due chip]
                       [tag] [tag] …                    (⋮)
                       2/5 subtasks
```

Tags sit on the second line under the title, not crammed onto the first. Hover shows `⋮`. Selected = accent edge. Completed = strikethrough. Overdue chip goes red. Drag shows a ghost + drop line.

| Input | Result |
|-------|--------|
| Checkbox | Toggle complete |
| Click row | Select → fill panel (clears multi-select) |
| Ctrl/Cmd+click | Toggle in multi-select |
| Shift+click | Range from anchor |
| Empty click / Esc | Clear selection |
| Double-click title | Inline edit |
| Right-click / `⋮` | Context menu |
| Drag | Reorder when sort is Custom |
| `Cmd/Ctrl+Shift+O` | Open in its own window |

### Context menu

Date & reminder (presets, duration, clear), priority, tags, move to list, add subtask, duplicate, open window, sticky note, delete, mark complete/incomplete.

Those actions live in the menu (or as read-only chips in the panel) — not as a button farm in the detail pane.

### Multi-select

Header shows `N selected`. With 2+ selected the panel is a short summary only (“right-click for bulk actions”) — never two editors. Bulk menu: date, priority, tags, move, complete, incomplete, delete.

### Quick add

Top of list. Enter creates; Shift+Enter creates and focuses the panel if we support it.

---

## Detail panel

Always visible in list view (~400px default). Content first: title, metadata chips, markdown body, subtasks, reminder/repeat summary. Auto-save on blur / ~500ms debounce. Pending sync can show a small badge.

| Selection | Panel |
|-----------|-------|
| 0 | Empty state |
| 1 | Full detail |
| 2+ | Summary only |

Settings hides the three-pane layout until you go back to a list. Integration slides over without throwing away the list underneath.

---

## Resizing

| Divider | Range | Setting |
|---------|-------|---------|
| Sidebar ↔ list | 180–360 (64 collapsed) | `layout.sidebar_width` |
| List ↔ panel | 280–560 | `layout.detail_width` |

Double-click a divider to reset. Collapse toggle for icons-only sidebar is separate from width.

---

## Task window & stickies

**Full window** — same slim detail, more room for markdown. Opens from the menu or `Cmd/Ctrl+Shift+O`. Edits hit the same DB; main list updates live.

**Sticky** — frameless window pinned to a task (title + description). One sticky per task; reopening focuses the existing one. Pin (`F12` / button) = always on top. Drag title bar, resize corner; position/size survive restart. Closing the sticky does not delete the task. Theme follows the main app.

---

## Calendar

Month / week / day / agenda, with a List ↔ Calendar switcher. Respect `week_starts_on` and the user’s timezone.

Duration tasks use `start_date` + `due_date`. Picker has Time vs Duration; all-day can span days. Week/day: drag a range on the grid to create. List chip shows `10:00–12:00` or `Aug 28 – Aug 30`. Smart lists use range overlap, not only the end date.

Still optional: drag to reschedule/resize on the grid, month multi-day drag-create.

---

## Integration panel

Slide-over (~360px) from the footer chip or `Cmd/Ctrl+Shift+S`.

Shows connection, last sync, progress, pending push breakdown, Pull / Sync now.  
Later: conflicts, interval, history.

Footer dot: green idle, orange pending push, blue while syncing, red on error, gray offline / disconnected.

---

## Settings

- **Account** — credentials, Connect / Disconnect, link to Integration
- **General** — timezone, time format, density
- **Calendar** — week start, visible hours, show all recurrence iterations, show completed tasks
- **Appearance** — font, light/dark/system, presets / image palette / custom colors, reset
- **Notifications** — enable, lead time
- **Desktop** — tray, auto-start, shortcuts, sticky pin default, backup export/restore
- **About** — version, open logs

Appearance stays local; pull must not overwrite it.

---

## Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+N` | New task |
| `Cmd/Ctrl+K` | Command palette / search |
| `Cmd/Ctrl+,` | Settings |
| `Esc` | Clear selection / close overlay |
| `Space` | Toggle complete (focused row) |
| `Delete` | Delete selected |
| `Cmd/Ctrl+Shift+O` | Task window |
| `Cmd/Ctrl+Shift+S` | Integration / sync |
| Global quick capture | Configurable (default often `Cmd/Ctrl+Shift+Space`) |

---

## Empty copy

| View | Copy |
|------|------|
| Inbox | Something like “Inbox zero” |
| Today | “No tasks due today” |
| Project | “No tasks in {name}” |
| Not connected | CTA to connect TickTick |

Animations: short cross-fades / checkbox fills (~150ms). Honor `prefers-reduced-motion`. Date chips: “Today”, “Tomorrow”, “Aug 28” — glance at the official app for density, don’t copy their icons.
