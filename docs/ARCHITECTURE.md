# Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ SQLite   │  │ Sync Engine│  │ TickTick    │  │ OAuth   │ │
│  │ (better- │  │ + Queue    │  │ API Client  │  │ Server  │ │
│  │ sqlite3) │  │            │  │             │  │         │ │
│  └────┬─────┘  └─────┬──────┘  └──────┬──────┘  └────┬────┘ │
│       │              │                 │              │       │
│       └──────────────┴─────────────────┴──────────────┘       │
│                              │ IPC (typed)                   │
└──────────────────────────────┼───────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────┐
│                     Preload (contextBridge)                   │
│              exposes limited, typed API to renderer           │
└──────────────────────────────┼───────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────┐
│                     Renderer (React)                          │
│  Routes / layout · Zustand (UI) · TanStack Query (IPC) · UI   │
└───────────────────────────────────────────────────────────────┘
```

## Why it’s split this way

- **SQLite in main** — single writer, native module, tokens never touch the renderer.
- **No TickTick HTTP from React** — OAuth secrets stay in main; sync is async.
- **Optimistic UI** — write locally first, reconcile when sync catches up.

| Concern | Where | Why |
|---------|-------|-----|
| Database | Main | Node native; one connection |
| HTTP / OAuth | Main | Secrets, no CORS fights |
| UI / routing | Renderer | React |
| File dialogs / tray / notifications | Main | Electron APIs |

Security baseline: `contextIsolation: true`, `nodeIntegration: false`, preload whitelist (`window.ticktick.*`), tokens via `safeStorage` when the OS supports it.

---

## Layout on disk

```
electron/
  main/          # DB, IPC, sync, TickTick client, windows, tray
  preload/       # contextBridge
src/             # React renderer
shared/          # entities, ipc-types, filters (no Node APIs)
resources/       # icons
docs/
```

Repositories under `electron/main/db/`, sync under `electron/main/sync/`, API under `electron/main/ticktick/`.

---

## IPC shape

Handlers return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

Common channels (not exhaustive — see `shared/channels.ts` / `ipc-types.ts`):

| Area | Examples |
|------|----------|
| Tasks | `task:list`, `create`, `update`, `complete`, `delete`, bulk variants, `openWindow` |
| Projects / folders | list / create / update / delete |
| Sync | `sync:getStatus`, `sync:now`, events `sync:status-changed`, `sync:progress`, `sync:changed` |
| Auth | `auth:connect`, `disconnect`, `status` |
| Settings / backup / sticky | matching `settings:*`, `backup:*`, `sticky:*` |

`sync:changed` is how the renderer invalidates TanStack Query — no polling the DB.

---

## State split

| Kind | Home | Examples |
|------|------|----------|
| Persisted data | SQLite → TanStack Query over IPC | Tasks, projects |
| Ephemeral UI | Zustand | Selection, sidebar collapsed, modals |
| Preferences | `settings` table + Query | Theme, timezone, tray |
| Sync internals | Main only | Queue, cursors, backoff |

---

## Sync (short version)

1. **Pull (done)** — folders → projects → inbox / project data → merge; skip dirty local rows.
2. **Push (done)** — mutations enqueue; worker drains to TickTick; set `remote_id`, clear queue.
3. **Next** — interval pull when online; conflict log in the Integration panel.

Full algorithms: [SYNC-STRATEGY.md](./SYNC-STRATEGY.md).

---

## Paths & packaging

| Platform | DB |
|----------|-----|
| Windows | `%APPDATA%/Open Tick/opentick.db` |
| macOS | `~/Library/Application Support/Open Tick/opentick.db` |
| Linux | `~/.config/Open Tick/opentick.db` |

Errors: normalize IPC codes (`NOT_FOUND`, `AUTH_EXPIRED`, `NETWORK`, …), map TickTick errors in main, log with electron-log, toast something generic in the UI.

Tests: unit (repos, mappers) in Vitest; sync with mocked HTTP; Playwright for smoke when we care about release.
