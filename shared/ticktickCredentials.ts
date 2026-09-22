/** TickTick OAuth / API credentials — user-editable (Settings) with env fallback. */

export const TICKTICK_SETTING_KEYS = {
  clientId: 'ticktick.client_id',
  /** Base64 of safeStorage-encrypted secret, or plaintext only when encryption unavailable in tests */
  clientSecretEnc: 'ticktick.client_secret_enc',
  redirectUri: 'ticktick.redirect_uri',
  region: 'ticktick.region',
  scopes: 'ticktick.scopes',
  /** Optional PAT stored encrypted (dev convenience) */
  accessTokenPatEnc: 'ticktick.access_token_pat_enc',
  accountLabel: 'ticktick.account_label',
  lastPullResult: 'sync.last_pull_result',
  lastErrorAt: 'sync.last_error_at',
  lastPullStats: 'sync.last_pull_stats',
  pushEnabled: 'sync.push_enabled',
} as const

export type TickTickRegion = 'ticktick' | 'dida365'

export const REGION_PRESETS: Record<
  TickTickRegion,
  { label: string; authBaseUrl: string; apiBaseUrl: string }
> = {
  ticktick: {
    label: 'TickTick (International)',
    authBaseUrl: 'https://ticktick.com',
    apiBaseUrl: 'https://api.ticktick.com/open/v1',
  },
  dida365: {
    label: 'Dida365 (China)',
    authBaseUrl: 'https://dida365.com',
    apiBaseUrl: 'https://api.dida365.com/open/v1',
  },
}

export const TICKTICK_CREDENTIAL_DEFAULTS = {
  redirectUri: 'http://127.0.0.1:18463/callback',
  region: 'ticktick' as TickTickRegion,
  scopes: 'tasks:read tasks:write',
}

/** Public shape returned to renderer (never includes plaintext secret). */
export interface TickTickCredentialsPublic {
  clientId: string
  /** Whether a client secret is stored (env or settings) */
  hasClientSecret: boolean
  redirectUri: string
  region: TickTickRegion
  scopes: string
  /** Whether a PAT is stored */
  hasAccessTokenPat: boolean
  /** True when values come only from env (not user settings) */
  fromEnv: boolean
}

export interface TickTickCredentialsInput {
  clientId: string
  /** Pass null to leave unchanged; empty string to clear */
  clientSecret?: string | null
  redirectUri: string
  region: TickTickRegion
  scopes: string
  /** Pass null to leave unchanged; empty string to clear */
  accessTokenPat?: string | null
}
