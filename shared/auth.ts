export interface OAuthTokens {
  access_token: string
  refresh_token?: string | null
  token_type?: string
  scope?: string
  expires_in?: number
  /** ISO timestamp when access token expires */
  expires_at: string | null
  obtained_at: string
}

export interface AuthStatus {
  connected: boolean
  /** Client ID + secret present (or PAT configured) */
  configured: boolean
  /** Using personal access token env shortcut */
  usingPat: boolean
  expiresAt: string | null
  /** Project count from last verification GET /project */
  projectCount: number | null
  lastVerifiedAt: string | null
  error: string | null
}

export interface TickTickConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  authBaseUrl: string
  apiBaseUrl: string
  scopes: string
  /** Dev-only personal access token */
  accessTokenPat: string | null
}
