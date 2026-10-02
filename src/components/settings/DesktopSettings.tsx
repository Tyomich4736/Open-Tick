import { useState } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { useDesktopSettings } from '@/hooks/useDesktopSettings'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-[var(--color-accent)]"
      />
    </label>
  )
}

export function DesktopSettings() {
  const { settings, ready, update } = useDesktopSettings()
  const addToast = useToastStore((s) => s.addToast)
  const [busy, setBusy] = useState(false)

  if (!ready) {
    return <p className="text-sm text-text-muted">Loading…</p>
  }

  async function exportBackup() {
    setBusy(true)
    try {
      const result = await ipc.backup.export()
      if (result.ok && result.data) {
        addToast(`Backup saved to ${result.data.path}`, 'success')
      } else if (result.ok) {
        /* cancelled */
      } else {
        addToast(result.error.message, 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function restoreBackup() {
    setBusy(true)
    try {
      const result = await ipc.backup.restore()
      if (result.ok && result.data?.restarted) {
        addToast('Restoring… app will restart', 'info')
      } else if (!result.ok) {
        addToast(result.error.message, 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  async function resetWindow() {
    const result = await ipc.desktop.resetWindow()
    if (result.ok) addToast('Window size reset', 'success')
    else addToast(result.error.message, 'error')
  }

  return (
    <section className="max-w-lg space-y-8">
      <div className="space-y-4">
        <h3 className="font-medium text-text-primary">Window & startup</h3>
        <ToggleRow
          label="Minimize to tray"
          description="Closing the window hides the app to the system tray instead of quitting"
          checked={settings.minimizeToTray}
          onChange={(v) => void update('minimizeToTray', v)}
        />
        <ToggleRow
          label="Start with system"
          description="Launch Open Tick when you sign in to your computer"
          checked={settings.autoStart}
          onChange={(v) => void update('autoStart', v)}
        />
        <button
          type="button"
          onClick={() => void resetWindow()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
        >
          <RotateCcw className="size-3.5" />
          Reset window size
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-text-primary">Global shortcuts</h3>
        <p className="text-xs text-text-muted">
          Use Electron accelerators (e.g. CommandOrControl+Shift+Space). Changes re-register
          immediately.
        </p>
        <label className="block text-sm text-text-primary">
          Quick capture
          <input
            type="text"
            value={settings.shortcutQuickCapture}
            onChange={(e) => void update('shortcutQuickCapture', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm text-text-primary">
          New sticky note
          <input
            type="text"
            value={settings.shortcutNewSticky}
            onChange={(e) => void update('shortcutNewSticky', e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium text-text-primary">Sticky notes</h3>
        <ToggleRow
          label="Pin by default"
          description="New sticky notes stay on top of other windows"
          checked={settings.stickyPinByDefault}
          onChange={(v) => void update('stickyPinByDefault', v)}
        />
      </div>

      <div className="space-y-3">
        <h3 className="font-medium text-text-primary">Backup</h3>
        <p className="text-sm text-text-muted">Export or restore your local SQLite database</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportBackup()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export backup
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void restoreBackup()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            <Upload className="size-3.5" />
            Restore backup
          </button>
        </div>
      </div>
    </section>
  )
}
