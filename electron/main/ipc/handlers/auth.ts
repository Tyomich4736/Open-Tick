import type { AuthStatus } from '@shared/auth'
import type { TickTickCredentialsInput } from '@shared/ticktickCredentials'
import {
  getCredentialsPublic,
  getTickTickConfig,
  isOAuthConfigured,
  notifyCredentialsChanged,
  saveCredentials,
} from '../../ticktick/config'
import { cancelOAuthFlow, startOAuthFlow } from '../../ticktick/oauth'
import { getTickTickClient } from '../../ticktick/TickTickClient'
import { getTokenService } from '../../ticktick/TokenService'
import { getSyncEngine } from '../../sync/SyncEngine'
import { runIpcHandler } from '../ipcWrapper'

const VERIFY_TIMEOUT_MS = 30_000

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

export function handleAuthStatus() {
  return runIpcHandler((): AuthStatus => {
    const tokens = getTokenService()
    const config = getTickTickConfig()
    const meta = tokens.getMeta()

    return {
      connected: tokens.isConnected(),
      configured: isOAuthConfigured(config) || Boolean(config.accessTokenPat),
      usingPat: tokens.usingPat(),
      expiresAt: tokens.getTokens()?.expires_at ?? null,
      projectCount: meta.projectCount,
      lastVerifiedAt: meta.lastVerifiedAt,
      error: meta.lastError,
    }
  })
}

export function handleAuthGetCredentials() {
  return runIpcHandler(() => getCredentialsPublic())
}

export function handleAuthSaveCredentials(_event: unknown, input: TickTickCredentialsInput) {
  return runIpcHandler(() => {
    const publicCreds = saveCredentials(input)
    notifyCredentialsChanged()
    return publicCreds
  })
}

export async function handleAuthConnect() {
  try {
    await startOAuthFlow()
    const projects = await withTimeout(
      getTickTickClient().listProjects(),
      VERIFY_TIMEOUT_MS,
      'Connected, but verifying the account timed out. Try Pull now from the Integration panel.',
    )
    getTokenService().setVerification(projects.length)
    void getSyncEngine()
      .runFullPull()
      .catch((error) => {
        console.warn('[auth] initial pull failed', error)
      })
    return handleAuthStatus()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect'
    if (!/cancelled|canceled/i.test(message)) {
      getTokenService().setError(message)
    }
    return {
      ok: false as const,
      error: { code: 'AUTH_ERROR', message },
    }
  }
}

export function handleAuthCancelConnect() {
  return runIpcHandler(() => {
    cancelOAuthFlow('Connection cancelled')
  })
}

export function handleAuthDisconnect() {
  return runIpcHandler(() => {
    cancelOAuthFlow('Disconnected')
    getTokenService().clearTokens()
    getSyncEngine().broadcastStatus()
  })
}

export async function handleAuthVerify() {
  try {
    if (!getTokenService().isConnected()) {
      return {
        ok: false as const,
        error: { code: 'AUTH_ERROR', message: 'Not connected to TickTick' },
      }
    }
    const projects = await withTimeout(
      getTickTickClient().listProjects(),
      VERIFY_TIMEOUT_MS,
      'Verification timed out',
    )
    getTokenService().setVerification(projects.length)
    return handleAuthStatus()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed'
    getTokenService().setError(message)
    return {
      ok: false as const,
      error: { code: 'AUTH_ERROR', message },
    }
  }
}
