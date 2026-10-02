# Open Tick (Desktop)

A cross-platform desktop task manager for **Windows**, **macOS**, and **Linux**, built with **Electron + React**. The app integrates with the [TickTick Open API](https://developer.ticktick.com/) while keeping a **local-first** copy of tasks, projects, and sync metadata on disk.

## Quick start

**Prerequisites:** Node.js 20+ and npm 10+

```bash
# Install dependencies
npm install

# Start dev server with hot reload
npm run dev

# Production build
npm run build

# Run packaged build locally
npm run preview

# Package installers (unsigned dev builds)
	npm run package:win   # Windows NSIS
	npm run package:mac   # macOS DMG (requires macOS)
	npm run package:linux # Linux AppImage + deb (x64)
```

## Goals

- Familiar TickTick-like UX: inbox, projects, today, calendar views, priorities, tags, subtasks
- **Local storage** as the source of truth for UI responsiveness and offline use
- **Bidirectional sync** with TickTick when online and authenticated
- Native desktop experience: system tray, global shortcuts, notifications, auto-start (optional)

## Project structure

```
electron/          Main process + preload scripts
src/               React renderer (UI)
shared/            Types and IPC channel constants
docs/              Architecture and implementation docs
resources/         App icons for packaging
```

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Phased delivery plan with milestones and acceptance criteria |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Electron process model, folder layout, tech stack |
| [docs/TICKTICK-API.md](./docs/TICKTICK-API.md) | OAuth, endpoints, rate limits, error handling |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) | Local entities, IDs, sync fields, TypeScript types |
| [docs/LOCAL-STORAGE.md](./docs/LOCAL-STORAGE.md) | SQLite schema, migrations, file locations |
| [docs/SYNC-STRATEGY.md](./docs/SYNC-STRATEGY.md) | Offline-first sync, conflict resolution, queue |
| [docs/UI-SPEC.md](./docs/UI-SPEC.md) | Screens, components, keyboard shortcuts, theming |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Setup, scripts, testing, packaging |
| [docs/IMPLEMENTATION-GUIDE.md](./docs/IMPLEMENTATION-GUIDE.md) | Conventions and step-by-step notes for implementers |

## Tech stack

| Layer | Choice |
|-------|--------|
| Shell | Electron 35 |
| UI | React 19 + TypeScript |
| Build | Vite + electron-vite |
| Styling | Tailwind CSS v4 |
| Packaging | electron-builder |
| Local DB | better-sqlite3 *(Phase 1)* |
| State | Zustand + TanStack Query *(Phase 2+)* |

## Status

**Phase 13 complete** — Initial TickTick pull: user-fillable OAuth credentials, GET client, inbound mappers, SyncEngine full pull, Integration panel + footer chip.

Next: **Phase 14** — Outbound push. See [ROADMAP](./docs/ROADMAP.md).

### TickTick OAuth setup

1. Register an app at [developer.ticktick.com](https://developer.ticktick.com/)
2. Set redirect URI to `http://127.0.0.1:18463/callback`
3. In the app: **Settings → Account** — fill **Client ID**, **Client Secret**, region, and save  
   (optional for dev: still works via `.env` / `TICKTICK_ACCESS_TOKEN`)
4. Click **Connect TickTick** — a full pull starts automatically

### Native module note (Windows)

`better-sqlite3` requires a native build. Use **Node.js 20 LTS** and install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload, then run:

```bash
npm install
npx electron-rebuild -f -w better-sqlite3
```

If `npm install` fails on `better-sqlite3`, run `npm install --ignore-scripts` then rebuild as above.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server + Electron with HMR |
| `npm run dev:seed` | Dev server with sample data (`--seed`) |
| `npm run test` | Repository unit tests (Vitest) |
| `npm run build` | Typecheck + production build to `out/` |
| `npm run preview` | Run production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run format` | Prettier write |
| `npm run package:win` | Windows installer |
| `npm run package:mac` | macOS DMG |

## License

TBD (personal pet project).
