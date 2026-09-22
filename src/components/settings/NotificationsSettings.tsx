import { useDesktopSettings } from '@/hooks/useDesktopSettings'

export function NotificationsSettings() {
  const { settings, ready, update } = useDesktopSettings()

  if (!ready) {
    return <p className="text-sm text-text-muted">Loading…</p>
  }

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <h3 className="font-medium text-text-primary">Reminders</h3>
        <p className="mt-1 text-sm text-text-muted">
          OS notifications for task reminders. Per-task reminder offsets control when they fire.
        </p>

        <label className="mt-4 flex cursor-pointer items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-text-primary">Enable notifications</div>
            <p className="mt-0.5 text-xs text-text-muted">Show desktop alerts when reminders are due</p>
          </div>
          <input
            type="checkbox"
            checked={settings.notificationsEnabled}
            onChange={(e) => void update('notificationsEnabled', e.target.checked)}
            className="mt-1 size-4 accent-[var(--color-accent)]"
          />
        </label>

        <label className="mt-4 block text-sm text-text-primary">
          Default lead time (minutes)
          <input
            type="number"
            min={0}
            max={10080}
            value={settings.notificationLeadMinutes}
            onChange={(e) =>
              void update('notificationLeadMinutes', Math.max(0, Number(e.target.value) || 0))
            }
            disabled={!settings.notificationsEnabled}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-50"
          />
          <span className="mt-1 block text-xs text-text-muted">
            Used as a fallback hint when tasks have no explicit reminders. Task-level reminders are
            the source of truth for fire times.
          </span>
        </label>
      </div>
    </section>
  )
}
