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
  pendingPush: { total: 0, tasks: 0, projects: 0, folders: 0 },
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
    const unsubStatus = ipc.onSyncStatusChanged(setStatus)
    const unsubProgress = ipc.onSyncProgress((p) => {
      setProgress(p)
      if (p.current >= p.total) {
        window.setTimeout(() => setProgress(null), 800)
      }
    })
    const unsubChanged = ipc.onChanged((notif) => {
      if (['task', 'project', 'folder'].includes(notif.entityType)) {
        void refresh()
      }
    })
    return () => {
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
