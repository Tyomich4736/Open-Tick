import { getTickTickConfig } from './config'
import { getTokenService } from './TokenService'
import type {
  RemoteProject,
  RemoteProjectData,
  RemoteProjectGroup,
  RemoteTask,
} from './remoteTypes'

/** TickTick completed-list filters prefer `…+0000` over `…Z`. */
export function toTickTickDateParam(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, '.000+0000').replace(/Z$/, '+0000')
}

/** Normalize `/task/completed` payloads (array or `{ tasks|data: [] }`). */
export function coerceRemoteTaskArray(data: unknown): RemoteTask[] {
  if (Array.isArray(data)) return data as RemoteTask[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.tasks)) return obj.tasks as RemoteTask[]
    if (Array.isArray(obj.data)) return obj.data as RemoteTask[]
  }
  return []
}

export class TickTickApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message)
    this.name = 'TickTickApiError'
  }

  static async fromResponse(response: Response): Promise<TickTickApiError> {
    const body = await response.text()
    let message = `TickTick API error ${response.status}`
    try {
      const json = JSON.parse(body) as { errorMessage?: string; error?: string }
      message = json.errorMessage ?? json.error ?? message
    } catch {
      if (body) message = body.slice(0, 200)
    }
    return new TickTickApiError(message, response.status, body)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class TickTickClient {
  constructor(
    private readonly tokenService = getTokenService(),
    private apiBaseUrl = getTickTickConfig().apiBaseUrl,
  ) {}

  /** Refresh base URL from current config (after credential/region change). */
  refreshConfig(): void {
    this.apiBaseUrl = getTickTickConfig().apiBaseUrl
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retried = false,
  ): Promise<T> {
    const token = await this.tokenService.getValidAccessToken()
    this.refreshConfig()

    let response: Response
    try {
      response = await fetch(`${this.apiBaseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error'
      throw new TickTickApiError(message, 0)
    }

    if (response.status === 401 && !retried) {
      const tokens = this.tokenService.getTokens()
      if (tokens?.refresh_token) {
        tokens.expires_at = new Date(0).toISOString()
        this.tokenService.saveTokens(tokens)
        return this.request<T>(method, path, body, true)
      }
      this.tokenService.clearTokens()
      throw new TickTickApiError('Authentication expired. Please reconnect.', 401)
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? '2')
      await sleep(Math.min(Math.max(retryAfter, 1), 60) * 1000)
      return this.request<T>(method, path, body, retried)
    }

    if (response.status >= 500 && !retried) {
      await sleep(500)
      return this.request<T>(method, path, body, true)
    }

    if (!response.ok) {
      throw await TickTickApiError.fromResponse(response)
    }

    // Complete / delete (and some updates) often return 200/204 with an empty body.
    // response.json() throws "Unexpected end of JSON input" on empty payloads.
    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    if (!text.trim()) {
      return undefined as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      throw new TickTickApiError(
        `Invalid JSON from TickTick (${response.status})`,
        response.status,
        text.slice(0, 200),
      )
    }
  }

  /** GET /project */
  async listProjects(): Promise<RemoteProject[]> {
    const data = await this.request<RemoteProject[]>('GET', '/project')
    return Array.isArray(data) ? data : []
  }

  /** GET /project/group */
  async listProjectGroups(): Promise<RemoteProjectGroup[]> {
    try {
      const data = await this.request<RemoteProjectGroup[]>('GET', '/project/group')
      return Array.isArray(data) ? data : []
    } catch (error) {
      // Some accounts / regions may not expose groups
      if (error instanceof TickTickApiError && (error.status === 404 || error.status === 403)) {
        return []
      }
      throw error
    }
  }

  /** GET /project/{id}/data */
  async getProjectData(projectRemoteId: string): Promise<RemoteProjectData> {
    return this.request<RemoteProjectData>(
      'GET',
      `/project/${encodeURIComponent(projectRemoteId)}/data`,
    )
  }

  /** GET /project/inbox/data */
  async getInboxData(): Promise<RemoteProjectData> {
    return this.request<RemoteProjectData>('GET', '/project/inbox/data')
  }

  /** GET /project/{projectId}/task/{taskId} — single task (includes completed). */
  async getTask(projectRemoteId: string, taskRemoteId: string): Promise<RemoteTask | null> {
    try {
      return await this.request<RemoteTask>(
        'GET',
        `/project/${encodeURIComponent(projectRemoteId)}/task/${encodeURIComponent(taskRemoteId)}`,
      )
    } catch (error) {
      if (error instanceof TickTickApiError && error.status === 404) return null
      throw error
    }
  }

  /**
   * POST /task/completed — completed tasks in a date range (`/data` omits them).
   * Responses are capped (~200); keep lookback windows small to avoid long pulls.
   */
  async listCompletedTasks(params: {
    projectIds?: string[]
    startDate: string
    endDate: string
  }): Promise<RemoteTask[]> {
    const data = await this.request<unknown>('POST', '/task/completed', {
      projectIds: params.projectIds,
      startDate: params.startDate,
      endDate: params.endDate,
    })
    return coerceRemoteTaskArray(data)
  }

  /**
   * Fetch completed tasks since `since` in a few fixed windows (capped).
   * Always advances the window — never half-steps — so pull cannot spin.
   */
  async listCompletedTasksSince(
    projectIds: string[],
    since: Date,
    options?: { windowDays?: number; maxWindows?: number },
  ): Promise<RemoteTask[]> {
    if (projectIds.length === 0) return []

    const windowDays = options?.windowDays ?? 45
    const maxWindows = options?.maxWindows ?? 2
    const windowMs = windowDays * 24 * 60 * 60 * 1000
    const seen = new Set<string>()
    const out: RemoteTask[] = []

    let windowEnd = new Date()
    for (let i = 0; i < maxWindows && windowEnd.getTime() > since.getTime(); i++) {
      const windowStart = new Date(Math.max(since.getTime(), windowEnd.getTime() - windowMs))
      const batch = await this.listCompletedTasks({
        projectIds,
        startDate: toTickTickDateParam(windowStart),
        endDate: toTickTickDateParam(windowEnd),
      })
      for (const task of batch) {
        if (!task?.id || seen.has(task.id)) continue
        seen.add(task.id)
        out.push(task)
      }
      windowEnd = windowStart
      if (i < maxWindows - 1 && windowEnd.getTime() > since.getTime()) {
        await sleep(120)
      }
    }

    return out
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 14 — Write methods (only called when push is explicitly enabled)
  // ─────────────────────────────────────────────────────────────────────────────

  /** POST /task — create task */
  async createTask(payload: unknown): Promise<unknown> {
    return this.request<unknown>('POST', '/task', payload)
  }

  /** POST /task/{taskId} — update task */
  async updateTask(taskRemoteId: string, payload: unknown): Promise<unknown> {
    return this.request<unknown>('POST', `/task/${encodeURIComponent(taskRemoteId)}`, payload)
  }

  /** POST /project/{projectId}/task/{taskId}/complete */
  async completeTask(projectRemoteId: string, taskRemoteId: string): Promise<void> {
    return this.request<void>(
      'POST',
      `/project/${encodeURIComponent(projectRemoteId)}/task/${encodeURIComponent(taskRemoteId)}/complete`,
    )
  }

  /** DELETE /project/{projectId}/task/{taskId} */
  async deleteTask(projectRemoteId: string, taskRemoteId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/project/${encodeURIComponent(projectRemoteId)}/task/${encodeURIComponent(taskRemoteId)}`,
    )
  }

  /** POST /project — create project */
  async createProject(payload: unknown): Promise<unknown> {
    return this.request<unknown>('POST', '/project', payload)
  }

  /** POST /project/{projectId} — update project */
  async updateProject(projectRemoteId: string, payload: unknown): Promise<unknown> {
    return this.request<unknown>('POST', `/project/${encodeURIComponent(projectRemoteId)}`, payload)
  }

  /** DELETE /project/{projectId} */
  async deleteProject(projectRemoteId: string): Promise<void> {
    return this.request<void>('DELETE', `/project/${encodeURIComponent(projectRemoteId)}`)
  }

  /** POST /project/group — create folder */
  async createFolder(payload: unknown): Promise<unknown> {
    return this.request<unknown>('POST', '/project/group', payload)
  }

  /** POST /project/group/{groupId} — update folder */
  async updateFolder(groupRemoteId: string, payload: unknown): Promise<unknown> {
    return this.request<unknown>('POST', `/project/group/${encodeURIComponent(groupRemoteId)}`, payload)
  }

  /** DELETE /project/group/{groupId} */
  async deleteFolder(groupRemoteId: string): Promise<void> {
    return this.request<void>('DELETE', `/project/group/${encodeURIComponent(groupRemoteId)}`)
  }

  /** POST /project/{projectId}/column — create section */
  async createColumn(projectRemoteId: string, payload: unknown): Promise<unknown> {
    return this.request<unknown>(
      'POST',
      `/project/${encodeURIComponent(projectRemoteId)}/column`,
      payload,
    )
  }

  /** POST /project/{projectId}/column/{columnId} — update section */
  async updateColumn(
    projectRemoteId: string,
    columnRemoteId: string,
    payload: unknown,
  ): Promise<unknown> {
    return this.request<unknown>(
      'POST',
      `/project/${encodeURIComponent(projectRemoteId)}/column/${encodeURIComponent(columnRemoteId)}`,
      payload,
    )
  }

  /** DELETE /project/{projectId}/column/{columnId} — may 404 on some accounts */
  async deleteColumn(projectRemoteId: string, columnRemoteId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/project/${encodeURIComponent(projectRemoteId)}/column/${encodeURIComponent(columnRemoteId)}`,
    )
  }

  /** POST /task/move — move task between projects */
  async moveTask(payload: {
    taskId: string
    fromProjectId: string
    toProjectId: string
  }): Promise<unknown> {
    return this.request<unknown>('POST', '/task/move', payload)
  }
}

let client: TickTickClient | null = null

export function getTickTickClient(): TickTickClient {
  if (!client) client = new TickTickClient()
  return client
}

export function resetTickTickClientForTests(): void {
  client = null
}
