# Architecture

## Overview

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
│  ┌──────────┐  ┌────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Routes / │  │ Zustand    │  │ TanStack    │  │ UI      │ │
│  │ Layout   │  │ UI state   │  │ Query (IPC) │  │ (shadcn)│ │
│  └──────────┘  └────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Design decisions

### Local-first

- **SQLite in the main process** is the canonical store for the UI.
- The renderer **never** talks to TickTick HTTP directly (tokens stay in main).
- Sync is asynchronous; UI updates optimistically then reconciles.

### Process boundaries

| Concern | Process | Reason |
|---------|---------|--------|
| Database | Main | Node native module; single writer |
| HTTP / OAuth | Main | Secret handling, CORS-free |
| UI / routing | Renderer | React ecosystem |
| File dialogs | Main | Electron `dialog` API |

### Security

- `contextIsolation: true`, `nodeIntegration: false` in BrowserWindow
- Preload exposes a whitelisted API surface (`window.ticktick.*`)
- OAuth `client_secret` and tokens only in main process
- Use Electron `safeStorage.encryptString` for token persistence when OS keychain available

---

## Proposed folder structure

```
ticktick-clone/
├── electron/
│   ├── main/
│   │   ├── index.ts              # App entry, window lifecycle
│   │   ├── ipc/
│   │   │   ├── handlers/         # task, project, sync, settings
│   │   │   └── channels.ts       # Channel name constants
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   ├── migrations/
│   │   │   └── repositories/
│   │   ├── sync/
│   │   │   ├── SyncEngine.ts
│   │   │   ├── OutboundQueue.ts
│   │   │   └── mappers/
│   │   ├── ticktick/
│   │   │   ├── TickTickClient.ts
│   │   │   ├── oauth.ts
│   │   │   └── types.ts          # API DTOs
│   │   └── services/
│   │       ├── NotificationService.ts
│   │       └── TrayService.ts
│   └── preload/
│       └── index.ts              # contextBridge API
├── src/                          # Renderer (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   ├── components/
│   │   ├── layout/
│   │   ├── tasks/
│   │   ├── projects/
│   │   └── settings/
│   ├── hooks/
│   ├── stores/
│   ├── lib/
│   │   └── ipc-client.ts         # Typed wrapper over preload API
│   └── styles/
├── shared/                       # Types shared main ↔ renderer
│   ├── ipc-types.ts
│   └── entities.ts
├── resources/                    # Icons, tray assets
├── docs/
├── electron.vite.config.ts
├── package.json
└── electron-builder.yml
```

---

## IPC contract (sketch)

All channels return `{ ok: true, data }` or `{ ok: false, error: { code, message } }`.

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `task:list` | invoke | Query tasks with filters |
| `task:get` | invoke | Single task + subtasks |
| `task:create` | invoke | Local create + enqueue sync |
| `task:update` | invoke | Local update + enqueue sync |
| `task:complete` | invoke | Mark complete |
| `task:delete` | invoke | Soft delete + enqueue |
| `task:bulkUpdate` | invoke | Apply field updates to many tasks (Phase 9) |
| `task:bulkDelete` | invoke | Delete many tasks (Phase 9) |
| `task:bulkComplete` | invoke | Complete/incomplete many tasks (Phase 9) |
| `task:openWindow` | invoke | Open task in dedicated window (Phase 8) |
| `task:closeWindow` | invoke | Close task window by id |
| `sticky:open` | invoke | Open sticky note for task (Phase 11) |
| `sticky:close` | invoke | Close sticky by task id |
| `sticky:setPinned` | invoke | Toggle always-on-top for sticky |
| `sticky:updateBounds` | invoke | Persist position/size after move/resize |
| `project:list` | invoke | All projects |
| `project:create` | invoke | |
| `sync:getStatus` | invoke | Full `SyncStatusDto` for Integration panel |
| `sync:now` | invoke | Trigger manual sync |
| `sync:status-changed` | event → renderer | Live sync state (pending counts, errors, progress) |
| `sync:progress` | event → renderer | Pull/push progress while syncing |
| `sync:changed` | event → renderer | Push DB change notifications |
| `auth:connect` | invoke | Start OAuth |
| `auth:disconnect` | invoke | Clear tokens |
| `auth:status` | invoke | Connected? token expiry? |
| `settings:get` / `settings:set` | invoke | User preferences |

Use **`sync:changed`** so TanStack Query can invalidate caches without polling.

---

## State management split

| State type | Where | Examples |
|------------|-------|----------|
| Server/local data | TanStack Query over IPC | Task lists, projects |
| Ephemeral UI | Zustand | Selected task ids, anchor id, sidebar collapsed, modal open |
| User settings | SQLite `settings` table + Query | Theme, timezone, notification prefs |
| Sync metadata | Main process only | Queue, cursors, backoff |

---

## Sync engine (high level)

**Phase 13:** inbound pull only. **Phase 14:** add outbound queue. **Phase 15:** incremental + conflicts.

1. **Inbound (Phase 13+)**: Fetch project list, then project data endpoints, merge into SQLite using mappers.
2. **Outbound (Phase 14+)**: After local mutation, insert row in `sync_queue`. Worker drains queue → TickTick API → update `remote_id`, clear queue item.
3. **Scheduler (Phase 15)**: `setInterval` when online; pause when offline (listen to `net.isOnline()`). Manual pull/sync available earlier via Integration panel.

See [SYNC-STRATEGY.md](./SYNC-STRATEGY.md) for details.

---

## Platform-specific notes

### Windows

- DB path: `%APPDATA%/<app-name>/ticktick.db`
- Tray icon required for background notifications
- NSIS installer via electron-builder

### macOS

- DB path: `~/Library/Application Support/<app-name>/ticktick.db`
- App menu + `Cmd+,` for settings
- DMG + notarization for distribution outside dev

### Linux (optional later)

- Not in v1 target; architecture supports it with minimal changes

---

## Dependencies (planned)

```json
{
  "dependencies": {
    "better-sqlite3": "^11",
    "electron-store": "^10",
    "date-fns": "^4",
    "date-fns-tz": "^3",
    "@tanstack/react-query": "^5",
    "zustand": "^5",
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7"
  },
  "devDependencies": {
    "electron": "^33",
    "electron-vite": "^3",
    "electron-builder": "^25",
    "typescript": "^5",
    "tailwindcss": "^4",
    "vitest": "^3",
    "@playwright/test": "^1"
  }
}
```

---

## Error handling strategy

- **IPC errors**: normalized error codes (`NOT_FOUND`, `SYNC_CONFLICT`, `AUTH_EXPIRED`, `NETWORK`)
- **API errors**: map TickTick `errorCode` to user-facing messages in main process
- **DB errors**: log to file (`electron-log`), show generic toast in UI
- **Fatal errors**: error boundary in React; main process uncaughtException → log + dialog

---

## Testing pyramid

| Level | Target |
|-------|--------|
| Unit | Repositories, mappers, date filters |
| Integration | Sync engine with mocked HTTP (msw/node) |
| E2E | Playwright: launch app, create task, verify list |

Main process tests run in Node (vitest); renderer with jsdom + Testing Library.
