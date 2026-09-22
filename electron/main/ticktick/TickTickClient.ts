import { getTickTickConfig } from './config'
import { getTokenService } from './TokenService'
import type { RemoteProject, RemoteProjectData, RemoteProjectGroup } from './remoteTypes'

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

    if (response.status === 204) {
      return undefined as T
    }

    if (!response.ok) {
      throw await TickTickApiError.fromResponse(response)
    }

    return (await response.json()) as T
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
