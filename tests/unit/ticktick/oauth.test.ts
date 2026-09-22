import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl } from '../../../electron/main/ticktick/oauthUrls'
import {
  tokensFromAuthCodeResponse,
  mergeTokenResponse,
} from '../../../electron/main/ticktick/TokenService'
import { parseRedirectPort } from '../../../electron/main/ticktick/config'
import type { OAuthTokens } from '../../../shared/auth'

describe('OAuth helpers', () => {
  it('builds authorize URL with state and scopes', () => {
    process.env.TICKTICK_CLIENT_ID = 'test-client'
    process.env.TICKTICK_CLIENT_SECRET = 'test-secret'
    process.env.TICKTICK_REDIRECT_URI = 'http://127.0.0.1:18463/callback'

    const url = new URL(buildAuthorizeUrl('abc123'))
    expect(url.origin).toBe('https://ticktick.com')
    expect(url.pathname).toBe('/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('test-client')
    expect(url.searchParams.get('state')).toBe('abc123')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toContain('tasks:read')
  })

  it('parses redirect port', () => {
    expect(parseRedirectPort('http://127.0.0.1:18463/callback')).toBe(18463)
    expect(parseRedirectPort('http://127.0.0.1/callback')).toBe(80)
  })

  it('creates tokens from auth code response', () => {
    const tokens = tokensFromAuthCodeResponse({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      token_type: 'bearer',
      scope: 'tasks:read tasks:write',
    })

    expect(tokens.access_token).toBe('access-1')
    expect(tokens.refresh_token).toBe('refresh-1')
    expect(tokens.expires_at).not.toBeNull()
  })

  it('merges refresh response keeping previous refresh token when omitted', () => {
    const previous: OAuthTokens = {
      access_token: 'old',
      refresh_token: 'keep-me',
      expires_at: null,
      obtained_at: new Date().toISOString(),
    }

    const next = mergeTokenResponse(previous, {
      access_token: 'new-access',
      expires_in: '7200',
    })

    expect(next.access_token).toBe('new-access')
    expect(next.refresh_token).toBe('keep-me')
    expect(next.expires_at).not.toBeNull()
  })
})
