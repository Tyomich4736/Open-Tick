import { useCallback, useEffect, useState } from 'react'
import type { AuthStatus } from '@shared/auth'
import { TICKTICK_SETTING_KEYS } from '@shared/ticktickCredentials'
import { ipc } from '@/lib/ipc-client'

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label
      className={[
        'flex items-start justify-between gap-4',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-[var(--color-accent)]"
      />
    </label>
  )
}

export function SyncSettings() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pullOnStartup, setPullOnStartup] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const [authRes, pushRes, pullRes] = await Promise.all([
      ipc.auth.status(),
      ipc.settings.get<boolean>(TICKTICK_SETTING_KEYS.pushEnabled),
      ipc.settings.get<boolean>(TICKTICK_SETTING_KEYS.pullOnStartup),
    ])
    if (authRes.ok) setAuth(authRes.data)
    if (pushRes.ok) setPushEnabled(!!pushRes.data)
    if (pullRes.ok) setPullOnStartup(!!pullRes.data)
    setReady(true)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const configured = Boolean(auth?.configured)

  if (!ready) {
    return <p className="text-sm text-text-muted">Loading…</p>
  }

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <h3 className="font-medium text-text-primary">TickTick sync</h3>
        <p className="mt-1 text-sm text-text-muted">
          Control when Open Tick exchanges data with TickTick. Configure credentials under Account
          first.
        </p>

        {!configured && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
            Save API credentials in Settings → Account to enable these options.
          </p>
        )}

        <div className="mt-4 space-y-4 rounded-lg border border-border p-4">
          <ToggleRow
            label="Enable push to TickTick"
            description="When enabled, local changes can be sent to TickTick. Use with caution."
            checked={pushEnabled}
            disabled={!configured}
            onChange={(next) => {
              setPushEnabled(next)
              void ipc.settings.set(TICKTICK_SETTING_KEYS.pushEnabled, next)
            }}
          />
          <ToggleRow
            label="Pull on application startup"
            description="When the app starts and you are connected, download the latest data from TickTick."
            checked={pullOnStartup}
            disabled={!configured}
            onChange={(next) => {
              setPullOnStartup(next)
              void ipc.settings.set(TICKTICK_SETTING_KEYS.pullOnStartup, next)
            }}
          />
        </div>
      </div>
    </section>
  )
}
