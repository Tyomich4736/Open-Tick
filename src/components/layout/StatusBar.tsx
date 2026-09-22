import { useSyncStatus } from '@/hooks/useSyncStatus'
import { useUiStore } from '@/stores/uiStore'

function formatRelative(iso: string | null): string {
  if (!iso) return 'Not synced'
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'Just synced'
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'Just synced'
  if (mins < 60) return `Synced ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Synced ${hours}h ago`
  return `Synced ${Math.floor(hours / 24)}d ago`
}

export function StatusBar() {
  const { status } = useSyncStatus()
  const toggle = useUiStore((s) => s.toggleIntegrationPanel)

  const syncStatus = status.isSyncing
    ? 'syncing'
    : status.lastError || status.lastSyncResult === 'failed'
      ? 'error'
      : 'idle'

  const label = status.isSyncing
    ? status.currentOperation || 'Pulling…'
    : !status.isConnected
      ? 'Not connected'
      : formatRelative(status.lastSyncAt)

  const statusColors = {
    idle: 'bg-emerald-500',
    syncing: 'animate-pulse bg-sky-500',
    error: 'bg-red-500',
  } as const

  return (
    <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-text-muted">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
        title="Open Integration panel"
      >
        <span className={`size-2 rounded-full ${statusColors[syncStatus]}`} aria-hidden />
        <span>{label}</span>
      </button>
      <span>Offline MVP · Pull sync</span>
    </footer>
  )
}
