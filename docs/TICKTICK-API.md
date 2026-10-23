# TickTick Open API

Official docs: [developer.ticktick.com](https://developer.ticktick.com/). What’s below is what we actually rely on in Open Tick — including quirks the portal glosses over.

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| TickTick (international) | `https://api.ticktick.com/open/v1` |
| Dida365 (China) | `https://api.dida365.com/open/v1` |

OAuth authorization host: `https://ticktick.com` (or Dida365 equivalent).

Community tools sometimes use different hosts for `task/move`, `task/completed`, `task/filter`. We stick to `api.ticktick.com` and keep a settings override if needed.

---

## Auth

### OAuth 2.0 (normal path)

1. Register at [Manage Apps](https://developer.ticktick.com/) → `client_id` / `client_secret`.
2. Redirect URI: `http://127.0.0.1:18463/callback` (must match exactly).
3. Scopes: `tasks:read tasks:write` (double-check the portal if auth fails).

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

Call `ensureValidToken()` before a batch of requests.

### Personal access token (dev shortcut)

Some accounts hand out a `tp_*` Bearer token without OAuth. Fine for local hacking; don’t make it the main product path.

Caveats we’ve hit:

- `GET /user/profile` may 404
- Stick to project-scoped task endpoints

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

### Extra endpoints (push / later)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/task/move` | Move task between projects |
| `POST` | `/task/completed` | List completed tasks |
| `POST` | `/task/filter` | Filter tasks server-side |
| `GET/POST/DELETE` | `/project/{projectId}/task/{taskId}/comment` | Comments |

We map columns as list **sections** (not a Kanban board UI). We don’t map habits, focus, or countdowns.

---

## Remote shapes

### Task

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

### Project

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `name` | string | |
| `color` | string | Hex `#RRGGBB` |
| `viewMode` | string | `list`, `kanban`, `timeline` |
| `kind` | string | Default `TASK` |
| `groupId` | string \| null | Parent folder id; omit for top-level |

---

## Inbox

Inbox’s project id looks like `inbox{userId}` and does **not** show up in `GET /project`. Grab it from an inbox task’s `projectId` or from `/project/inbox/data`, then stash it locally. Empty brand-new inbox: you may not know the id until the first task exists — don’t crash on that.

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

## Rate limits

Public docs don’t spell them out. We cap ~5 concurrent requests, put ~200ms between project-data fetches on a full pull, and back off on 429.

---

## OAuth loopback

```
Connect → listen on 127.0.0.1:18463
→ open authorize URL in the browser
→ /callback?code=&state=
→ check state, exchange code, shut down the server
→ save tokens, start pull
```

Random `state`, bind to loopback only, give up after a few minutes if nothing comes back.

---

## Dev env

```env
TICKTICK_CLIENT_ID=
TICKTICK_CLIENT_SECRET=
TICKTICK_REDIRECT_URI=http://127.0.0.1:18463/callback
TICKTICK_API_BASE=https://api.ticktick.com/open/v1
# Optional: TICKTICK_ACCESS_TOKEN=tp_...
```

Dev can load these from `.env`; real users go through OAuth in Settings.

Use a throwaway TickTick account for API experiments. Mock `fetch` in tests with sanitized fixtures — never commit tokens.

## References

- [TickTick Help — API Support](https://help.ticktick.com/articles/7055781495671095296)
- [ticktick-cli endpoint map](https://www.npmjs.com/package/@ticktick/ticktick-cli) (handy for undocumented bits)
