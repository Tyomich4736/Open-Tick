import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Unplug } from 'lucide-react'
import type { AuthStatus } from '@shared/auth'
import {
  REGION_PRESETS,
  TICKTICK_CREDENTIAL_DEFAULTS,
  type TickTickRegion,
} from '@shared/ticktickCredentials'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'
import { useUiStore } from '@/stores/uiStore'

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'No expiry recorded'
  try {
    return new Date(expiresAt).toLocaleString()
  } catch {
    return expiresAt
  }
}

export function AccountSettings() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const addToast = useToastStore((s) => s.addToast)
  const setIntegrationOpen = useUiStore((s) => s.setIntegrationPanelOpen)

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [secretDirty, setSecretDirty] = useState(false)
  const [hasSecret, setHasSecret] = useState(false)
  const [redirectUri, setRedirectUri] = useState(TICKTICK_CREDENTIAL_DEFAULTS.redirectUri)
  const [region, setRegion] = useState<TickTickRegion>(TICKTICK_CREDENTIAL_DEFAULTS.region)
  const [scopes, setScopes] = useState(TICKTICK_CREDENTIAL_DEFAULTS.scopes)
  const [pat, setPat] = useState('')
  const [patDirty, setPatDirty] = useState(false)
  const [hasPat, setHasPat] = useState(false)
  const [fromEnv, setFromEnv] = useState(false)
  const [credsBusy, setCredsBusy] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  const refreshAuth = useCallback(async () => {
    const result = await ipc.auth.status()
    if (result.ok) setAuth(result.data)
  }, [])

  const refreshPushSetting = useCallback(async () => {
    const res = await ipc.settings.get<boolean>('sync.push_enabled')
    if (res.ok) setPushEnabled(!!res.data)
  }, [])

  const refreshCredentials = useCallback(async () => {
    const result = await ipc.auth.getCredentials()
    if (!result.ok) return
    const c = result.data
    setClientId(c.clientId)
    setHasSecret(c.hasClientSecret)
    setSecretDirty(false)
    setClientSecret('')
    setRedirectUri(c.redirectUri)
    setRegion(c.region)
    setScopes(c.scopes)
    setHasPat(c.hasAccessTokenPat)
    setPatDirty(false)
    setPat('')
    setFromEnv(c.fromEnv)
  }, [])

  useEffect(() => {
    void refreshAuth()
    void refreshCredentials()
    void refreshPushSetting()
  }, [refreshAuth, refreshCredentials, refreshPushSetting])

  async function saveCreds() {
    setCredsBusy(true)
    try {
      const result = await ipc.auth.saveCredentials({
        clientId,
        clientSecret: secretDirty ? clientSecret : null,
        redirectUri,
        region,
        scopes,
        accessTokenPat: patDirty ? pat : null,
      })
      if (result.ok) {
        addToast('API credentials saved', 'success')
        setHasSecret(result.data.hasClientSecret)
        setHasPat(result.data.hasAccessTokenPat)
        setSecretDirty(false)
        setClientSecret('')
        setPatDirty(false)
        setPat('')
        setFromEnv(result.data.fromEnv)
        await refreshAuth()
      } else {
        addToast(result.error.message, 'error')
      }
    } finally {
      setCredsBusy(false)
    }
  }

  async function connect() {
    setAuthBusy(true)
    try {
      const result = await ipc.auth.connect()
      if (result.ok) {
        setAuth(result.data)
        addToast(
          result.data.projectCount != null
            ? `Connected — ${result.data.projectCount} lists · pull started`
            : 'Connected to TickTick · pull started',
          'success',
        )

        // Refresh push setting after connect in case it affects visibility
        void refreshPushSetting()
        setIntegrationOpen(true)
      } else if (!/cancelled|canceled/i.test(result.error.message)) {
        addToast(result.error.message, 'error')
        await refreshAuth()
      } else {
        await refreshAuth()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      addToast(message, 'error')
      await refreshAuth()
    } finally {
      setAuthBusy(false)
    }
  }

  async function cancelConnect() {
    await ipc.auth.cancelConnect()
    setAuthBusy(false)
  }

  useEffect(() => {
    return () => {
      void ipc.auth.cancelConnect()
    }
  }, [])

  async function disconnect() {
    setAuthBusy(true)
    try {
      const result = await ipc.auth.disconnect()
      if (result.ok) {
        addToast('Disconnected from TickTick', 'success')
        await refreshAuth()
      } else {
        addToast(result.error.message, 'error')
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function verify() {
    setAuthBusy(true)
    try {
      const result = await ipc.auth.verify()
      if (result.ok) {
        setAuth(result.data)
        addToast(
          result.data.projectCount != null
            ? `Verified — ${result.data.projectCount} lists`
            : 'Connection verified',
          'success',
        )
      } else {
        await refreshAuth()
      }
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <section className="max-w-lg space-y-10">
      <div>
        <h3 className="font-medium text-text-primary">API credentials</h3>
        <p className="mt-1 text-sm text-text-muted">
          Register an app at developer.ticktick.com and paste your Client ID and Client Secret here.
          Secrets are encrypted on this device. Environment variables still work as a fallback.
        </p>

        <div className="mt-4 rounded-lg border border-border p-4">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={pushEnabled}
              onChange={async (e) => {
                const next = e.target.checked
                setPushEnabled(next)
                await ipc.settings.set('sync.push_enabled', next)
              }}
              className="size-4 accent-[var(--color-accent)]"
            />
            <span className="font-medium text-text-primary">Enable push to TickTick</span>
          </label>
          <p className="mt-1.5 text-xs text-text-muted">
            When enabled, local changes will be sent to TickTick. <span className="font-semibold text-amber-600 dark:text-amber-400">Use with caution.</span>
          </p>
        </div>
        {fromEnv && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Currently using values from environment variables. Saving here overrides them for this
            install.
          </p>
        )}

        <label className="mt-4 block text-sm text-text-primary">
          Client ID
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="mt-3 block text-sm text-text-primary">
          Client secret
          <input
            type="password"
            value={clientSecret}
            placeholder={hasSecret ? '•••••••• (leave blank to keep)' : 'Enter client secret'}
            onChange={(e) => {
              setClientSecret(e.target.value)
              setSecretDirty(true)
            }}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="mt-3 block text-sm text-text-primary">
          Region
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as TickTickRegion)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {(Object.keys(REGION_PRESETS) as TickTickRegion[]).map((key) => (
              <option key={key} value={key}>
                {REGION_PRESETS[key].label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm text-text-primary">
          Redirect URI
          <input
            type="text"
            value={redirectUri}
            onChange={(e) => setRedirectUri(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
          <span className="mt-1 block text-xs text-text-muted">
            Must match the redirect URI in the TickTick developer portal.
          </span>
        </label>

        <label className="mt-3 block text-sm text-text-primary">
          Scopes
          <input
            type="text"
            value={scopes}
            onChange={(e) => setScopes(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="mt-3 block text-sm text-text-primary">
          Personal access token (optional, dev)
          <input
            type="password"
            value={pat}
            placeholder={hasPat ? '•••••••• (leave blank to keep)' : 'tp_… optional shortcut'}
            onChange={(e) => {
              setPat(e.target.value)
              setPatDirty(true)
            }}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>

        <button
          type="button"
          disabled={credsBusy}
          onClick={() => void saveCreds()}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {credsBusy ? 'Saving…' : 'Save credentials'}
        </button>
      </div>

      <div>
        <h3 className="font-medium text-text-primary">TickTick account</h3>
        <p className="mt-1 text-sm text-text-muted">
          Connect via OAuth. After connect, a full pull downloads folders, lists, and tasks.
        </p>

        {auth && (
          <div className="mt-4 space-y-2 rounded-lg border border-border bg-bg-primary px-3 py-3 text-sm">
            <div className="flex items-center gap-2">
              {auth.connected ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <Unplug className="size-4 text-text-muted" />
              )}
              <span className="font-medium text-text-primary">
                {auth.connected
                  ? auth.usingPat
                    ? 'Connected (personal access token)'
                    : 'Connected'
                  : auth.configured
                    ? 'Not connected'
                    : 'Not configured'}
              </span>
            </div>
            {!auth.configured && (
              <p className="text-text-muted">Save a Client ID and Client Secret above, then connect.</p>
            )}
            {auth.connected && (
              <>
                <p className="text-text-muted">Expires: {formatExpiry(auth.expiresAt)}</p>
                {auth.projectCount != null && (
                  <p className="text-text-muted">Lists visible: {auth.projectCount}</p>
                )}
                {auth.lastVerifiedAt && (
                  <p className="text-text-muted">
                    Last verified: {new Date(auth.lastVerifiedAt).toLocaleString()}
                  </p>
                )}
              </>
            )}
            {auth.error && <p className="text-priority-high">{auth.error}</p>}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!auth?.connected ? (
            authBusy ? (
              <>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white opacity-80"
                >
                  <Loader2 className="size-4 animate-spin" />
                  Waiting for browser…
                </button>
                <button
                  type="button"
                  onClick={() => void cancelConnect()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!auth?.configured}
                onClick={() => void connect()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Connect TickTick
              </button>
            )
          ) : (
            <>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void verify()}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                {authBusy && <Loader2 className="size-4 animate-spin" />}
                Verify connection
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void disconnect()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-priority-high hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950"
              >
                Disconnect
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIntegrationOpen(true)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
          >
            Open Integration panel
          </button>
        </div>
        {authBusy && !auth?.connected && (
          <p className="mt-2 text-xs text-text-muted">
            Finish signing in in your browser, or Cancel if TickTick showed an error without
            returning to the app.
          </p>
        )}
      </div>
    </section>
  )
}
