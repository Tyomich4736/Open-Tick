# Development Guide

Setup, scripts, testing, and packaging for the Electron + React Open Tick app.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20 LTS or 22 |
| npm | 10+ |
| Git | any recent |
| Windows | VS Build Tools (for better-sqlite3 native compile) |
| macOS | Xcode Command Line Tools |

---

## Initial setup (when implementing Phase 0)

```bash
# From project root
npm create @electron-vite/create@latest . -- --template react-ts
npm install better-sqlite3 date-fns date-fns-tz zustand @tanstack/react-query
npm install -D @types/better-sqlite3 tailwindcss vitest @testing-library/react
```

Configure native rebuild:

```bash
npm install -D electron-rebuild
# postinstall script: electron-rebuild -f -w better-sqlite3
```

---

## Environment

Copy `.env.example` → `.env` (gitignored):

```env
TICKTICK_CLIENT_ID=
TICKTICK_CLIENT_SECRET=
TICKTICK_REDIRECT_URI=http://127.0.0.1:18463/callback
```

Register redirect URI in TickTick developer portal to match exactly.

---

## npm scripts (planned)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start electron-vite dev server + Electron |
| `npm run build` | Production build (renderer + main) |
| `npm run preview` | Run packaged build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` in all packages |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright against built app |
| `npm run package:win` | electron-builder Windows |
| `npm run package:mac` | electron-builder macOS |
| `npm run db:seed` | Dev seed data |

---

## Project conventions

### TypeScript

- `strict: true`
- Path alias: `@/` → `src/`, `@shared/` → `shared/`
- No `any` without eslint disable comment

### Commits

Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`

### Branches

- `main` — stable
- `feat/phase-N-description` — feature branches aligned to roadmap phases

---

## Running on Windows

```powershell
cd /path/to/open-tick
npm run dev
```

If `better-sqlite3` fails to load:

```powershell
npx electron-rebuild -f -w better-sqlite3
```

---

## Running on macOS

```bash
npm run dev
```

Gatekeeper may block unsigned builds — allow in System Settings for dev.

---

## Debugging

### Main process

- electron-vite supports `--inspect` on main
- VS Code launch config:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Main",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-vite",
  "args": ["--sourcemap", "--remote-debugging-port=9222"]
}
```

### Renderer

- Chrome DevTools in Electron window (Ctrl+Shift+I)
- React DevTools extension optional

### SQLite

- Dev-only IPC: `debug:query` with read-only SQL (never in production builds)

---

## Testing

### Unit tests (Vitest)

```
tests/
├── unit/
│   ├── repositories/
│   ├── mappers/
│   └── filters/
└── fixtures/
    └── ticktick/
        ├── projects.json
        └── project-data.json
```

Run: `npm run test`

### Component tests

- Testing Library + jsdom for `TaskRow`, `QuickAdd`
- Mock IPC via `window.ticktick` stub in `setupTests.ts`

### E2E (Playwright)

```typescript
// tests/e2e/create-task.spec.ts
test('creates task offline', async ({ electronApp }) => {
  const page = await electronApp.firstWindow();
  await page.getByPlaceholder('Add task').fill('Test task');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Test task')).toBeVisible();
});
```

---

## Packaging

`electron-builder.yml` sketch:

```yaml
appId: com.opentick.app
productName: Open Tick
directories:
  output: release
files:
  - dist/**/*
  - resources/**/*
win:
  target: nsis
mac:
  target: dmg
  category: public.app-category.productivity
```

Native module note: ensure `better-sqlite3` is unpacked from asar:

```yaml
asarUnpack:
  - "**/*.node"
```

---

## CI (GitHub Actions sketch)

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
```

Build matrix for Win/Mac on release tags only (requires code signing secrets).

---

## Code signing (release)

### macOS

- Apple Developer ID Application certificate
- Notarize with `@electron/notarize`
- Hardened runtime entitlements for Electron

### Windows

- Authenticode certificate (optional for personal use)
- SmartScreen warnings expected without cert

Document in README when approaching Phase 8.

---

## .gitignore essentials

```
node_modules/
dist/
release/
.env
*.db
auth.enc
logs/
.DS_Store
Thumbs.db
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank window in dev | Check preload path in electron-vite config |
| IPC invoke timeout | Verify handler registered before window load |
| OAuth callback never hits | Firewall blocking loopback; try different port |
| Sync duplicates | Check unique index on `remote_id`; review merge logic |
| WAL locked | Ensure single DB connection in main process |

---

## Related docs

- [ROADMAP.md](./ROADMAP.md) — what to build next
- [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) — agent-oriented build order
- [ARCHITECTURE.md](./ARCHITECTURE.md) — process model
