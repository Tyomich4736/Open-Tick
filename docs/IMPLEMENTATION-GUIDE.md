# Implementation notes

Phases 0–14 are in the tree (offline app, pull, and push). What’s left is incremental sync and release polish — plus a few house rules so we don’t undo the architecture.

For the big picture, see [ROADMAP.md](./ROADMAP.md).

---

## House rules

- SQLite and TickTick HTTP live in the **main** process only. Renderer talks over typed IPC (`window.ticktick` / `shared/ipc-types.ts`).
- UI keys are always **local** UUIDs. Resolve `remote_id` in main when calling the API.
- Soft-delete until a remote delete confirms. Don’t hard-delete synced rows on the first click.
- TickTick’s public docs are thin. If a response disagrees with [TICKTICK-API.md](./TICKTICK-API.md), log it (dev), update that doc, then fix the mapper.

---

## Phase 15 — Incremental + conflicts

- Re-fetch projects + project data on a timer (API has no solid delta feed).
- Dirty local rows: skip on inbound merge; push when ready.
- Surface conflicts / failures in the Integration panel log (last ~100 entries is enough).
- Auth expiry pauses sync and asks to reconnect.

See [SYNC-STRATEGY.md](./SYNC-STRATEGY.md).

---

## Phase 16 — Hardening

- Playwright smoke: offline CRUD, connect → pull → push.
- Signing / notarization notes when we actually ship installers.
- Optional: electron-updater, Sentry — only if we want them.

---

## Quick reminders

| Temptation | Do this instead |
|------------|-----------------|
| Open SQLite from React | Main process repositories |
| Stick the OAuth token in Zustand | Encrypted file / `safeStorage` in main |
| Use `remote_id` as a React key | Local `id` |
| POST on every keystroke | Debounce; queue one update per entity |
| Block the UI while syncing | Background worker + status events |

When in doubt: [ARCHITECTURE.md](./ARCHITECTURE.md), [DATA-MODEL.md](./DATA-MODEL.md), [LOCAL-STORAGE.md](./LOCAL-STORAGE.md).
