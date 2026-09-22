import { createServer, type Server } from 'http'
import { randomBytes } from 'crypto'
import { shell } from 'electron'
import type { OAuthTokens } from '@shared/auth'
import { getTickTickConfig, isOAuthConfigured, parseRedirectPort } from './config'
import { buildAuthorizeUrl } from './oauthUrls'
import {
  getTokenService,
  parseTokenResponse,
  tokensFromAuthCodeResponse,
} from './TokenService'

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

interface ActiveOAuth {
  cancel: (reason?: string) => void
}

let activeOAuth: ActiveOAuth | null = null

function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, Segoe UI, sans-serif; padding: 40px; color: #191919; }
    h1 { font-size: 20px; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${body}</p>
</body>
</html>`
}

async function exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
  const config = getTickTickConfig()
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
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
    throw new Error(`Token exchange failed (${response.status}): ${text}`)
  }

  const payload = await parseTokenResponse(response)
  return tokensFromAuthCodeResponse(payload)
}

/** Cancel an in-progress browser OAuth wait (stops spinner / frees callback port). */
export function cancelOAuthFlow(reason = 'OAuth cancelled'): void {
  activeOAuth?.cancel(reason)
  activeOAuth = null
}

export function isOAuthInProgress(): boolean {
  return activeOAuth != null
}

export async function startOAuthFlow(): Promise<OAuthTokens> {
  // Replace any stuck previous attempt
  cancelOAuthFlow('OAuth restarted')

  const config = getTickTickConfig()

  if (config.accessTokenPat) {
    const tokens: OAuthTokens = {
      access_token: config.accessTokenPat,
      refresh_token: null,
      expires_at: null,
      obtained_at: new Date().toISOString(),
    }
    getTokenService().saveTokens(tokens)
    return tokens
  }

  if (!isOAuthConfigured(config)) {
    throw new Error(
      'TickTick OAuth is not configured. Add Client ID and Client Secret in Settings → Account (or set them in .env).',
    )
  }

  const state = randomBytes(24).toString('hex')
  const redirect = new URL(config.redirectUri)
  const port = parseRedirectPort(config.redirectUri)
  const pathname = redirect.pathname || '/callback'

  if (redirect.hostname !== '127.0.0.1' && redirect.hostname !== 'localhost') {
    throw new Error('Redirect URI must use 127.0.0.1 or localhost for desktop OAuth')
  }

  return new Promise<OAuthTokens>((resolve, reject) => {
    let server: Server | null = null
    let settled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (server) {
        try {
          server.close()
        } catch {
          /* ignore */
        }
        server = null
      }
      if (activeOAuth?.cancel === cancel) activeOAuth = null
    }

    const fail = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const succeed = (tokens: OAuthTokens) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(tokens)
    }

    const cancel = (reason = 'OAuth cancelled') => {
      fail(new Error(reason))
    }

    activeOAuth = { cancel }

    timeout = setTimeout(() => {
      fail(new Error('OAuth timed out. Please try connecting again.'))
    }, CALLBACK_TIMEOUT_MS)

    server = createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
        if (requestUrl.pathname !== pathname) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlPage('Not found', 'Unexpected callback path.'))
          return
        }

        const error = requestUrl.searchParams.get('error')
        if (error) {
          const description = requestUrl.searchParams.get('error_description') ?? error
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlPage('Authorization failed', description))
          fail(new Error(description))
          return
        }

        const code = requestUrl.searchParams.get('code')
        const returnedState = requestUrl.searchParams.get('state')

        if (!code || !returnedState) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlPage('Authorization failed', 'Missing code or state.'))
          fail(new Error('OAuth callback missing code or state'))
          return
        }

        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(htmlPage('Authorization failed', 'Invalid state parameter.'))
          fail(new Error('OAuth state mismatch'))
          return
        }

        void exchangeCodeForTokens(code)
          .then((tokens) => {
            getTokenService().saveTokens(tokens)
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(
              htmlPage(
                'Connected to TickTick',
                'You can close this window and return to the app.',
              ),
            )
            succeed(tokens)
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : 'Token exchange failed'
            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(htmlPage('Authorization failed', message))
            fail(error instanceof Error ? error : new Error(message))
          })
      } catch (error) {
        fail(error instanceof Error ? error : new Error('OAuth callback failed'))
      }
    })

    server.on('error', (error) => {
      const message =
        (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
          ? `OAuth callback port ${port} is already in use. Click Cancel, wait a moment, and try again.`
          : error.message
      fail(new Error(message))
    })

    server.listen(port, '127.0.0.1', () => {
      const authorizeUrl = buildAuthorizeUrl(state)
      void shell.openExternal(authorizeUrl).catch((error: unknown) => {
        fail(error instanceof Error ? error : new Error('Failed to open browser'))
      })
    })
  })
}
