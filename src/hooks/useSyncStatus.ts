import { useCallback, useEffect, useState } from 'react'
import type { SyncProgressEvent, SyncStatusDto } from '@shared/sync'
import { ipc } from '@/lib/ipc-client'

const emptyStatus: SyncStatusDto = {
  isConnected: false,
  configured: false,
  accountLabel: null,
  isOnline: true,
  isSyncing: false,
  lastSyncAt: null,
  lastSyncResult: null,
  lastError: null,
  lastErrorAt: null,
  pushEnabled: false,
  pendingPush: { total: 0, tasks: 0, projects: 0, folders: 0, sections: 0 },
  conflicts: 0,
  currentOperation: null,
  autoSyncIntervalMinutes: 3,
  nextSyncAt: null,
  lastPullStats: null,
  inboxRemoteId: null,
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatusDto>(emptyStatus)
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const result = await ipc.sync.getStatus()
    if (result.ok) setStatus(result.data)
  }, [])

  useEffect(() => {
    void refresh().finally(() => setReady(true))
    let clearTimer: number | undefined
    const unsubStatus = ipc.onSyncStatusChanged((next) => {
      setStatus(next)
      // Don't leave a half-finished bar up after sync ends
      if (!next.isSyncing) {
        window.clearTimeout(clearTimer)
        clearTimer = window.setTimeout(() => setProgress(null), 400)
      }
    })
    const unsubProgress = ipc.onSyncProgress((p) => {
      setProgress((prev) => {
        // Ignore out-of-order events that would shrink the bar
        if (
          prev &&
          prev.total > 0 &&
          p.total > 0 &&
          p.current / p.total + 1e-9 < prev.current / prev.total
        ) {
          return prev
        }
        return p
      })
      if (p.current >= p.total && p.total > 0) {
        window.clearTimeout(clearTimer)
        clearTimer = window.setTimeout(() => setProgress(null), 600)
      }
    })
    const unsubChanged = ipc.onChanged((notif) => {
      if (['task', 'project', 'folder', 'section'].includes(notif.entityType)) {
        void refresh()
      }
    })
    return () => {
      window.clearTimeout(clearTimer)
      unsubStatus()
      unsubProgress()
      unsubChanged()
    }
  }, [refresh])

  const pullNow = useCallback(async () => {
    const result = await ipc.sync.now()
    await refresh()
    return result
  }, [refresh])

  return { status, progress, ready, refresh, pullNow }
}
