import { useState } from 'react'
import { AboutSettings } from '@/components/settings/AboutSettings'
import { AppearanceSettings } from '@/components/settings/AppearanceSettings'
import { AccountSettings } from '@/components/settings/AccountSettings'
import { CalendarSettings } from '@/components/settings/CalendarSettings'
import { DesktopSettings } from '@/components/settings/DesktopSettings'
import { NotificationsSettings } from '@/components/settings/NotificationsSettings'
import { useTimeFormat, type TimeFormat } from '@/hooks/useTimeFormat'
import { useListDensity } from '@/hooks/useLayoutSettings'
import { listTimezones, useTimezone } from '@/hooks/useTimezone'

type SettingsTab =
  | 'general'
  | 'calendar'
  | 'appearance'
  | 'desktop'
  | 'notifications'
  | 'account'
  | 'about'

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'account', label: 'Account' },
  { id: 'about', label: 'About' },
]

function GeneralSettings() {
  const { timeFormat, setTimeFormat } = useTimeFormat()
  const { density, setDensity } = useListDensity()
  const { timezoneSetting, timezone, systemTimezone, setTimezone } = useTimezone()
  const timezones = listTimezones()

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <h3 className="font-medium text-text-primary">Date & time</h3>
        <p className="mt-1 text-sm text-text-muted">How times are shown across the app</p>

        <label className="mt-4 block text-sm text-text-primary">
          Time format
          <select
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value as TimeFormat)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="12h">12-hour (3:00 PM)</option>
            <option value="24h">24-hour (15:00)</option>
          </select>
        </label>

        <label className="mt-4 block text-sm text-text-primary">
          Timezone
          <select
            value={timezoneSetting}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="system">System default ({systemTimezone})</option>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>
        {timezoneSetting === 'system' && (
          <p className="mt-1.5 text-xs text-text-muted">
            Using {timezone} from your OS settings
          </p>
        )}
      </div>

      <div>
        <h3 className="font-medium text-text-primary">List density</h3>
        <p className="mt-1 text-sm text-text-muted">Spacing of rows in the task list</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDensity(opt.value)}
              className={[
                'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                density === opt.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-muted hover:border-accent/40',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('general')

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
        <p className="mt-0.5 text-sm text-text-muted">Preferences and account</p>
        <div className="mt-4 flex gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                tab === item.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        {tab === 'general' && <GeneralSettings />}
        {tab === 'calendar' && <CalendarSettings />}
        {tab === 'appearance' && <AppearanceSettings />}
        {tab === 'desktop' && <DesktopSettings />}
        {tab === 'notifications' && <NotificationsSettings />}
        {tab === 'account' && <AccountSettings />}
        {tab === 'about' && <AboutSettings />}
      </div>
    </div>
  )
}
