# Roadmap

Offline MVP is done. TickTick pull and push both work. Next is incremental sync and conflict handling so we aren’t stuck on full pulls forever.

## Done (phases 0–14)

Local app with no account required:

- SQLite in the main process, typed IPC, React UI
- Lists, folders, tags, priorities, subtasks, drag reorder
- Markdown notes, reminders, recurrence
- Smart lists, sorting, multi-select / bulk actions
- Calendar (month / week / day / agenda) and duration tasks
- Themes, fonts, sticky notes, tray, reminders, search, backup
- OAuth connect + full inbound pull (folders, projects, tasks)
- Outbound push — queue, mappers, soft-delete until remote confirms, Integration panel pending counts (push behind a settings toggle)

Still unfinished stretch items from earlier work (nice to have, not blocking):

- Drag to reschedule / resize on the calendar
- Month multi-day drag-create
- Collapse the task panel on narrow windows
- A few sidebar menu items (change color, clear all completed)

## Next

### Phase 15 — Incremental sync & conflicts

Stop relying on full pulls forever.

- Periodic pull when online and focused (a few minutes)
- Conflict rule: dirty local rows win until pushed; otherwise remote wins — log the weird cases
- Deletion both ways; backoff on 429/5xx
- Sync log / history in the Integration panel

Done when: an edit in the official TickTick app shows up locally within the interval, and reconnects don’t duplicate rows.

Details: [SYNC-STRATEGY.md](./SYNC-STRATEGY.md).

### Phase 16 — Release hardening

- Smoke E2E (offline path + connect → pull → push)
- Signing notes for Mac/Windows; optional auto-update
- A week of real use with sync on without losing data

## Not building

Habits, Focus / Pomodoro, and countdowns stay out. Same for collaboration / shared lists until we know the API well enough.

## Later, maybe

Kanban, timeline, custom smart lists, attachments, comments, calendar subscribe, task templates, multi-account. Sticky notes stay local-only unless TickTick exposes something useful.

## Docs map

| Want | Read |
|------|------|
| How processes fit together | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Entities / IDs | [DATA-MODEL.md](./DATA-MODEL.md) |
| Schema on disk | [LOCAL-STORAGE.md](./LOCAL-STORAGE.md) |
| Sync algorithms | [SYNC-STRATEGY.md](./SYNC-STRATEGY.md) |
| API quirks | [TICKTICK-API.md](./TICKTICK-API.md) |
| Screens & shortcuts | [UI-SPEC.md](./UI-SPEC.md) |
| Dev setup | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| What’s left to code | [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) |
| Hand-test checklist | [MANUAL-TESTS.md](./MANUAL-TESTS.md) |
