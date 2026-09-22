import { app, safeStorage } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { OAuthTokens } from '@shared/auth'
import { getTickTickConfig } from './config'

const AUTH_FILE = 'auth.enc'
const AUTH_META_FILE = 'auth.meta.json'

interface AuthMeta {
  lastVerifiedAt: string | null
  projectCount: number | null
  lastError: string | null
}

export class TokenService {
  private tokens: OAuthTokens | null = null
  private meta: AuthMeta = {
    lastVerifiedAt: null,
    projectCount: null,
    lastError: null,
  }
  private refreshPromise: Promise<string> | null = null

  constructor() {
    this.loadMeta()
    this.loadTokens()
  }

  private authPath(): string {
    return join(app.getPath('userData'), AUTH_FILE)
  }

  private metaPath(): string {
    return join(app.getPath('userData'), AUTH_META_FILE)
  }

  private loadMeta(): void {
    try {
      if (!existsSync(this.metaPath())) return
      this.meta = JSON.parse(readFileSync(this.metaPath(), 'utf8')) as AuthMeta
    } catch {
      this.meta = { lastVerifiedAt: null, projectCount: null, lastError: null }
    }
  }

  private saveMeta(): void {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(this.metaPath(), JSON.stringify(this.meta, null, 2), 'utf8')
  }

  private loadTokens(): void {
    const pat = getTickTickConfig().accessTokenPat
    if (pat) {
      this.tokens = {
        access_token: pat,
        refresh_token: null,
        expires_at: null,
        obtained_at: new Date().toISOString(),
      }
      return
    }

    try {
      if (!existsSync(this.authPath())) {
        this.tokens = null
        return
      }
      const encrypted = readFileSync(this.authPath())
      if (!safeStorage.isEncryptionAvailable()) {
        console.warn('[auth] safeStorage unavailable; cannot decrypt tokens')
        this.tokens = null
        return
      }
      const json = safeStorage.decryptString(encrypted)
      this.tokens = JSON.parse(json) as OAuthTokens
    } catch (error) {
      console.error('[auth] failed to load tokens', error)
      this.tokens = null
    }
  }

  saveTokens(tokens: OAuthTokens): void {
    this.tokens = tokens
    if (this.usingPat()) {
      // PAT comes from env; keep in memory only
      this.meta.lastError = null
      this.saveMeta()
      return
    }

    mkdirSync(app.getPath('userData'), { recursive: true })

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS secure storage is unavailable; cannot save OAuth tokens')
    }

    const encrypted = safeStorage.encryptString(JSON.stringify(tokens))
    writeFileSync(this.authPath(), encrypted)
    this.meta.lastError = null
    this.saveMeta()
  }

  clearTokens(): void {
    this.tokens = null
    this.meta = { lastVerifiedAt: null, projectCount: null, lastError: null }
    try {
      if (existsSync(this.authPath())) unlinkSync(this.authPath())
      if (existsSync(this.metaPath())) unlinkSync(this.metaPath())
    } catch (error) {
      console.error('[auth] failed to clear token files', error)
    }
  }

  getTokens(): OAuthTokens | null {
    return this.tokens
  }

  isConnected(): boolean {
    return Boolean(this.tokens?.access_token)
  }

  usingPat(): boolean {
    return Boolean(getTickTickConfig().accessTokenPat)
  }

  getMeta(): AuthMeta {
    return { ...this.meta }
  }

  setVerification(projectCount: number): void {
    this.meta.lastVerifiedAt = new Date().toISOString()
    this.meta.projectCount = projectCount
    this.meta.lastError = null
    this.saveMeta()
  }

  setError(message: string): void {
    this.meta.lastError = message
    this.saveMeta()
  }

  isExpired(skewMs = 60_000): boolean {
    if (!this.tokens?.expires_at) return false
    return Date.parse(this.tokens.expires_at) - skewMs <= Date.now()
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.tokens?.access_token) {
      throw new Error('Not connected to TickTick')
    }

    if (this.usingPat()) {
      return this.tokens.access_token
    }

    if (!this.isExpired()) {
      return this.tokens.access_token
    }

    if (!this.tokens.refresh_token) {
      throw new Error('Access token expired and no refresh token is available. Please reconnect.')
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshAccessToken().finally(() => {
        this.refreshPromise = null
      })
    }

    return this.refreshPromise
  }

  private async refreshAccessToken(): Promise<string> {
    const config = getTickTickConfig()
    const refreshToken = this.tokens?.refresh_token
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    })

    const response = await fetch(`${config.authBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      const text = await response.text()
      this.clearTokens()
      throw new Error(`Token refresh failed (${response.status}): ${text}`)
    }

    const payload = await parseTokenResponse(response)
    const next = mergeTokenResponse(this.tokens!, payload)
    this.saveTokens(next)
    return next.access_token
  }
}

export async function parseTokenResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as Record<string, unknown>
  }

  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const params = new URLSearchParams(text)
    const result: Record<string, unknown> = {}
    for (const [key, value] of params.entries()) {
      result[key] = value
    }
    return result
  }
}

export function mergeTokenResponse(
  previous: OAuthTokens,
  payload: Record<string, unknown>,
): OAuthTokens {
  const accessToken = String(payload.access_token ?? '')
  if (!accessToken) {
    throw new Error('Token response missing access_token')
  }

  const expiresInRaw = payload.expires_in
  const expiresIn =
    typeof expiresInRaw === 'number'
      ? expiresInRaw
      : typeof expiresInRaw === 'string'
        ? Number(expiresInRaw)
        : undefined

  const expiresAt =
    expiresIn && Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : previous.expires_at

  return {
    access_token: accessToken,
    refresh_token:
      (typeof payload.refresh_token === 'string' ? payload.refresh_token : null) ??
      previous.refresh_token ??
      null,
    token_type: typeof payload.token_type === 'string' ? payload.token_type : previous.token_type,
    scope: typeof payload.scope === 'string' ? payload.scope : previous.scope,
    expires_in: expiresIn,
    expires_at: expiresAt,
    obtained_at: new Date().toISOString(),
  }
}

export function tokensFromAuthCodeResponse(payload: Record<string, unknown>): OAuthTokens {
  const accessToken = String(payload.access_token ?? '')
  if (!accessToken) {
    throw new Error('Token response missing access_token')
  }

  const expiresInRaw = payload.expires_in
  const expiresIn =
    typeof expiresInRaw === 'number'
      ? expiresInRaw
      : typeof expiresInRaw === 'string'
        ? Number(expiresInRaw)
        : undefined

  return {
    access_token: accessToken,
    refresh_token: typeof payload.refresh_token === 'string' ? payload.refresh_token : null,
    token_type: typeof payload.token_type === 'string' ? payload.token_type : 'bearer',
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    expires_in: expiresIn,
    expires_at:
      expiresIn && Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : null,
    obtained_at: new Date().toISOString(),
  }
}

let tokenService: TokenService | null = null

export function getTokenService(): TokenService {
  if (!tokenService) tokenService = new TokenService()
  return tokenService
}

export function resetTokenServiceForTests(): void {
  tokenService = null
}
