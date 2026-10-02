# Development

Day-to-day setup for Open Tick (Electron + React).

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS (or 22) |
| npm | 10+ |
| Windows | VS Build Tools — “Desktop development with C++” (for `better-sqlite3`) |
| macOS | Xcode Command Line Tools |

---

## First run

```bash
npm install
npm run rebuild:native   # if better-sqlite3 fails to load
npm run dev
```

Sample data:

```bash
npm run dev:seed
```

Copy `.env.example` → `.env` if you want OAuth client values in the environment (optional — the Account settings UI can hold them too):

```env
TICKTICK_CLIENT_ID=
TICKTICK_CLIENT_SECRET=
TICKTICK_REDIRECT_URI=http://127.0.0.1:18463/callback
```

Redirect URI must match the TickTick developer portal exactly.

---

## Scripts

| Script | What it does |
|--------|----------------|
| `npm run dev` | Electron + Vite hot reload |
| `npm run dev:seed` | Same, with seed data |
| `npm run build` | Production build → `out/` |
| `npm run preview` | Run the production build |
| `npm run test` | Vitest |
| `npm run test:watch` | Vitest watch |
| `npm run lint` / `typecheck` | Quality gates |
| `npm run format` | Prettier |
| `npm run package:win` / `:mac` / `:linux` | Installers via electron-builder |
| `npm run rebuild:native` | Rebuild `better-sqlite3` for Electron |

---

## Conventions

- TypeScript `strict`, aliases `@/` → `src/`, `@shared/` → `shared/`
- Prefer conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`
- Feature branches named after the work (`feat/phase-14-push`, etc.)

---

## Debugging

**Main** — electron-vite can launch with inspect; a VS Code launch config pointing at `electron-vite` with `--sourcemap` works fine.

**Renderer** — DevTools in the window (`Ctrl/Cmd+Shift+I`).

**SQLite** — keep a single connection in main. Don’t open the DB from the renderer.

---

## Packaging notes

`better-sqlite3` is a native module — unpack `*.node` from asar (`asarUnpack` in electron-builder). Unsigned Windows builds will trip SmartScreen; macOS Gatekeeper will complain until notarized.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Blank window in dev | Preload path in electron-vite config |
| IPC timeout | Handler registered after the window already loaded |
| OAuth never returns | Firewall / loopback; confirm port `18463` |
| Sync duplicates | Unique index on `remote_id`; check merge skip of dirty rows |
| WAL locked | More than one process holding the DB |

---

## Related

- [ROADMAP.md](./ROADMAP.md) — what’s next
- [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) — incremental sync / release work left
- [ARCHITECTURE.md](./ARCHITECTURE.md) — process split
- [MANUAL-TESTS.md](./MANUAL-TESTS.md) — hand-test checklist
