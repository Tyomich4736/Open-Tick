import { getTickTickConfig } from './config'

export function buildAuthorizeUrl(state: string): string {
  const config = getTickTickConfig()
  const url = new URL(`${config.authBaseUrl}/oauth/authorize`)
  url.searchParams.set('client_id', config.clientId)
  url.searchParams.set('redirect_uri', config.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', config.scopes)
  url.searchParams.set('state', state)
  return url.toString()
}
