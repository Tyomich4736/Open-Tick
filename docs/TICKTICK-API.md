# TickTick Open API Integration

Official documentation: [developer.ticktick.com](https://developer.ticktick.com/)

This document covers authentication, endpoints, DTO mapping, and implementation notes for the desktop app.

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| TickTick (international) | `https://api.ticktick.com/open/v1` |
| Dida365 (China) | `https://api.dida365.com/open/v1` |

OAuth authorization host: `https://ticktick.com` (or Dida365 equivalent).

> **Note:** Some community tools report mixed base URLs for certain endpoints (`task/move`, `task/completed`, `task/filter`). Implement v1 with `api.ticktick.com` and add a settings override if needed.

---

## Authentication

### Option A — OAuth 2.0 (recommended for desktop app)

1. Register application at [Manage Apps](https://developer.ticktick.com/) → obtain `client_id` and `client_secret`.
2. Set redirect URI to loopback, e.g. `http://127.0.0.1:18463/callback`.
3. Request scopes: `tasks:read tasks:write` (confirm exact scope strings in portal during implementation).

**Authorization URL**

```
GET https://ticktick.com/oauth/authorize
  ?client_id={CLIENT_ID}
  &scope=tasks:read tasks:write
  &state={RANDOM_STATE}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
```

**Token exchange** (main process, after receiving `code`):

```
POST https://ticktick.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={CODE}
&redirect_uri={REDIRECT_URI}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```

Store response fields:

- `access_token` — use in `Authorization: Bearer {token}` header
- `refresh_token` — if provided, use before expiry
- `expires_in` — schedule refresh

**Token refresh**

```
POST https://ticktick.com/oauth/token

grant_type=refresh_token
&refresh_token={REFRESH_TOKEN}
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
```

Implement `TickTickClient.ensureValidToken()` called before each API batch.

### Option B — Personal access token (dev only)

Some accounts expose a `tp_*` token usable directly as Bearer token without OAuth. Useful for development; **do not** ship this as the primary UX for end users.

Limitations observed in the wild:

- May not work with `GET /user/profile` (404)
- Always use project-scoped task endpoints

---

## HTTP client requirements

```typescript
// Pseudocode — main process only
class TickTickClient {
  constructor(private baseUrl: string, private tokenService: TokenService) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.tokenService.getValidAccessToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw await TickTickApiError.fromResponse(res);
    return res.json();
  }
}
```

**Retry policy**

| Status | Action |
|--------|--------|
| 401 | Refresh token once, retry; else prompt re-auth |
| 429 | Respect `Retry-After` or exponential backoff |
| 5xx | Retry up to 3 times with backoff |

---

## Core endpoints (v1 scope)

### Projects

| Method | Path | Use in app |
|--------|------|------------|
| `GET` | `/project` | List projects for sidebar + sync |
| `GET` | `/project/{projectId}` | Project metadata |
| `GET` | `/project/{projectId}/data` | Bulk fetch tasks per project |
| `GET` | `/project/inbox/data` | Inbox tasks |
| `POST` | `/project` | Create project locally → push |
| `POST` | `/project/{projectId}` | Update project |
| `DELETE` | `/project/{projectId}` | Delete project |

### Project groups (folders)

TickTick calls these **folders** in the UI and **project groups** in the API. One level of nesting only — projects reference a folder via `groupId`.

| Method | Path | Use in app |
|--------|------|------------|
| `GET` | `/project/group` | List folders for sidebar + sync |
| `POST` | `/project/group` | Create folder locally → push |
| `POST` | `/project/group/{projectGroupId}` | Rename or reorder folder |
| `DELETE` | `/project/group/{projectGroupId}` | Delete folder (projects inside are ungrouped) |

Assign a project to a folder by setting `groupId` on create/update (`POST /project` or `POST /project/{projectId}`). Omit or clear `groupId` for top-level projects.

### Tasks

| Method | Path | Use in app |
|--------|------|------------|
| `GET` | `/project/{projectId}/task/{taskId}` | Fetch single task (reconciliation) |
| `POST` | `/task` | Create task |
| `POST` | `/task/{taskId}` | Update task (note: not project-scoped) |
| `POST` | `/project/{projectId}/task/{taskId}/complete` | Complete task |
| `DELETE` | `/project/{projectId}/task/{taskId}` | Delete task |

### Extended endpoints (Phase 14+ / optional)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/task/move` | Move task between projects |
| `POST` | `/task/completed` | List completed tasks |
| `POST` | `/task/filter` | Filter tasks server-side |
| `GET/POST/DELETE` | `/project/{projectId}/task/{taskId}/comment` | Comments |

Column create/update/delete endpoints (if exposed by TickTick) are deferred for push sync. Column APIs are not mapped locally yet.

Defer habits, focus, and countdown until after MVP.

---

## API data types

### Task (remote)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Remote ID; assign to local `remote_id` after sync |
| `title` | string | Required |
| `projectId` | string | Inbox uses special id (see below) |
| `content` | string | Markdown/plain notes |
| `priority` | number | `0` none, `1` low, `3` medium, `5` high |
| `dueDate` | string | ISO 8601 with offset |
| `startDate` | string | ISO 8601 |
| `isAllDay` | boolean | |
| `tags` | string[] | Tag names |
| `timeZone` | string | IANA, e.g. `Europe/Moscow` |
| `parentId` | string | Subtask parent |
| `status` | number | `0` pending, `2` completed |
| `kind` | string | Default `TEXT` |

### Project (remote)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `name` | string | |
| `color` | string | Hex `#RRGGBB` |
| `viewMode` | string | `list`, `kanban`, `timeline` |
| `kind` | string | Default `TASK` |
| `groupId` | string \| null | Parent folder id; omit for top-level |

---

## Inbox special case

- Inbox project ID is **per-user**, format like `inbox{userId}` — **not** returned by `GET /project`.
- Discover from any inbox task's `projectId`, or from `GET /project/inbox/data` response context.
- Store discovered inbox id in local `settings` table after first successful sync.
- Empty inbox: cannot discover id until first task exists — handle gracefully in UI.

---

## Create / update examples

**Create task**

```json
POST /open/v1/task
{
  "title": "Buy groceries",
  "projectId": "abc123",
  "content": "Milk, eggs",
  "priority": 3,
  "dueDate": "2026-08-28T18:00:00+03:00",
  "isAllDay": false,
  "timeZone": "Europe/Moscow",
  "tags": ["errands"]
}
```

**Create subtask**

```json
{
  "title": "Subtask",
  "projectId": "same-as-parent",
  "parentId": "parent-remote-id"
}
```

**Complete task**

```
POST /open/v1/project/{projectId}/task/{taskId}/complete
```

(No body required.)

---

## Error response shape

```json
{
  "errorId": "...",
  "errorCode": "client_exception",
  "errorMessage": "Human-readable message"
}
```

Map to app error codes:

| API situation | App code |
|---------------|----------|
| 401 | `AUTH_EXPIRED` |
| 404 | `NOT_FOUND` |
| 400 | `VALIDATION_ERROR` |
| Network failure | `NETWORK_ERROR` |

---

## Rate limiting

TickTick does not publish explicit limits in public docs. Implement:

- Max **5 concurrent** API requests
- Minimum **200ms** between batch project data fetches during initial sync
- Back off on 429

---

## OAuth loopback server (main process)

```
1. User clicks "Connect TickTick"
2. Main starts HTTP server on 127.0.0.1:18463
3. shell.openExternal(authorizeUrl)
4. Browser redirects to /callback?code=...&state=...
5. Validate state, exchange code, stop server
6. Persist tokens, trigger initial sync
```

**Security**

- Generate cryptographically random `state`, validate on callback
- Bind server to `127.0.0.1` only
- Close server after success or 5-minute timeout

---

## Environment variables (development)

```env
TICKTICK_CLIENT_ID=
TICKTICK_CLIENT_SECRET=
TICKTICK_REDIRECT_URI=http://127.0.0.1:18463/callback
TICKTICK_API_BASE=https://api.ticktick.com/open/v1
# Optional dev shortcut:
# TICKTICK_ACCESS_TOKEN=tp_...
```

Load via `dotenv` in main process for dev; production uses user OAuth only.

---

## Testing against API

- Use a dedicated TickTick test account
- Integration tests mock `fetch` with fixtures saved from real responses (sanitize tokens)
- Never commit tokens or record HTTP cassettes with secrets

---

## References

- [TickTick Help — API Support](https://help.ticktick.com/articles/7055781495671095296)
- [TickTick CLI API mapping](https://www.npmjs.com/package/@ticktick/ticktick-cli) — comprehensive endpoint list for v2 features
