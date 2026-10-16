import { getRepositories } from '../db/connection'
import { resetTickTickClientForTests } from './TickTickClient'
import { getTokenService, resetTokenServiceForTests } from './TokenService'
import type { TickTickConfig } from '@shared/auth'
import {
  REGION_PRESETS,
  TICKTICK_CREDENTIAL_DEFAULTS,
  TICKTICK_SETTING_KEYS,
  type TickTickCredentialsInput,
  type TickTickCredentialsPublic,
  type TickTickRegion,
} from '@shared/ticktickCredentials'
import { safeStorage } from 'electron'

const DEFAULT_REDIRECT = TICKTICK_CREDENTIAL_DEFAULTS.redirectUri
const DEFAULT_SCOPES = TICKTICK_CREDENTIAL_DEFAULTS.scopes

function encryptValue(plain: string): string {
  if (!plain) return ''
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(plain).toString('base64')
  }
  // Fallback for headless/test — not for production secrets
  return Buffer.from(plain, 'utf8').toString('base64')
}

function decryptValue(encoded: string | null | undefined): string {
  if (!encoded) return ''
  try {
    const buf = Buffer.from(encoded, 'base64')
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(buf)
    }
    return buf.toString('utf8')
  } catch {
    return ''
  }
}

function readSetting<T>(key: string): T | null {
  try {
    return getRepositories().settings.get<T>(key)
  } catch {
    return null
  }
}

function writeSetting(key: string, value: unknown): void {
  getRepositories().settings.set(key, value)
}

function envClientId(): string {
  return process.env.TICKTICK_CLIENT_ID?.trim() ?? ''
}

function envClientSecret(): string {
  return process.env.TICKTICK_CLIENT_SECRET?.trim() ?? ''
}

function envPat(): string | null {
  return process.env.TICKTICK_ACCESS_TOKEN?.trim() || null
}

function resolveRegion(raw: string | null | undefined): TickTickRegion {
  return raw === 'dida365' ? 'dida365' : 'ticktick'
}

/** Full runtime config: user settings override env. */
export function getTickTickConfig(): TickTickConfig {
  const region = resolveRegion(
    readSetting<string>(TICKTICK_SETTING_KEYS.region) ??
      (process.env.TICKTICK_REGION?.trim() as TickTickRegion | undefined) ??
      TICKTICK_CREDENTIAL_DEFAULTS.region,
  )
  const preset = REGION_PRESETS[region]

  const storedId = readSetting<string>(TICKTICK_SETTING_KEYS.clientId)?.trim() ?? ''
  const storedSecret = decryptValue(readSetting<string>(TICKTICK_SETTING_KEYS.clientSecretEnc))
  const storedPat = decryptValue(readSetting<string>(TICKTICK_SETTING_KEYS.accessTokenPatEnc))

  const authBase =
    process.env.TICKTICK_AUTH_BASE?.trim() ||
    preset.authBaseUrl
  const apiBase =
    process.env.TICKTICK_API_BASE?.trim() ||
    preset.apiBaseUrl

  return {
    clientId: storedId || envClientId(),
    clientSecret: storedSecret || envClientSecret(),
    redirectUri:
      readSetting<string>(TICKTICK_SETTING_KEYS.redirectUri)?.trim() ||
      process.env.TICKTICK_REDIRECT_URI?.trim() ||
      DEFAULT_REDIRECT,
    authBaseUrl: authBase.replace(/\/$/, ''),
    apiBaseUrl: apiBase.replace(/\/$/, ''),
    scopes:
      readSetting<string>(TICKTICK_SETTING_KEYS.scopes)?.trim() ||
      process.env.TICKTICK_SCOPES?.trim() ||
      DEFAULT_SCOPES,
    accessTokenPat: storedPat || envPat(),
  }
}

export function isOAuthConfigured(config: TickTickConfig = getTickTickConfig()): boolean {
  return Boolean(config.clientId && config.clientSecret)
}

export function parseRedirectPort(redirectUri: string): number {
  try {
    const url = new URL(redirectUri)
    if (url.port) return Number(url.port)
    return url.protocol === 'https:' ? 443 : 80
  } catch {
    return 18463
  }
}

export function getCredentialsPublic(): TickTickCredentialsPublic {
  const storedId = readSetting<string>(TICKTICK_SETTING_KEYS.clientId)?.trim() ?? ''
  const storedSecret = decryptValue(readSetting<string>(TICKTICK_SETTING_KEYS.clientSecretEnc))
  const storedPat = decryptValue(readSetting<string>(TICKTICK_SETTING_KEYS.accessTokenPatEnc))
  const fromEnv =
    !storedId &&
    !storedSecret &&
    !storedPat &&
    Boolean(envClientId() || envClientSecret() || envPat())

  const config = getTickTickConfig()
  return {
    clientId: config.clientId,
    hasClientSecret: Boolean(config.clientSecret),
    redirectUri: config.redirectUri,
    region: resolveRegion(
      readSetting<string>(TICKTICK_SETTING_KEYS.region) ?? TICKTICK_CREDENTIAL_DEFAULTS.region,
    ),
    scopes: config.scopes,
    hasAccessTokenPat: Boolean(config.accessTokenPat),
    fromEnv,
  }
}

export function saveCredentials(input: TickTickCredentialsInput): TickTickCredentialsPublic {
  writeSetting(TICKTICK_SETTING_KEYS.clientId, input.clientId.trim())
  writeSetting(TICKTICK_SETTING_KEYS.redirectUri, input.redirectUri.trim() || DEFAULT_REDIRECT)
  writeSetting(TICKTICK_SETTING_KEYS.region, input.region)
  writeSetting(TICKTICK_SETTING_KEYS.scopes, input.scopes.trim() || DEFAULT_SCOPES)

  if (input.clientSecret !== null && input.clientSecret !== undefined) {
    const trimmed = input.clientSecret.trim()
    if (!trimmed) {
      writeSetting(TICKTICK_SETTING_KEYS.clientSecretEnc, '')
    } else {
      writeSetting(TICKTICK_SETTING_KEYS.clientSecretEnc, encryptValue(trimmed))
    }
  }

  if (input.accessTokenPat !== null && input.accessTokenPat !== undefined) {
    const trimmed = input.accessTokenPat.trim()
    if (!trimmed) {
      writeSetting(TICKTICK_SETTING_KEYS.accessTokenPatEnc, '')
    } else {
      writeSetting(TICKTICK_SETTING_KEYS.accessTokenPatEnc, encryptValue(trimmed))
    }
  }

  // Reload tokens if PAT changed
  return getCredentialsPublic()
}

/** Invalidate cached clients after credential changes. */
export function notifyCredentialsChanged(): void {
  resetTickTickClientForTests()
  resetTokenServiceForTests()
  getTokenService()
}
