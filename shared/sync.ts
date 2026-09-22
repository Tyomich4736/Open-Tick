/** Sync status DTOs shared between main and renderer (Phase 13+). */

export interface SyncPendingPush {
  total: number
  tasks: number
  projects: number
  folders: number
}

export interface SyncPullStats {
  folders: number
  projects: number
  tasks: number
  skippedDirty: number
}

export interface SyncStatusDto {
  isConnected: boolean
  configured: boolean
  accountLabel: string | null
  isOnline: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  lastSyncResult: 'success' | 'partial' | 'failed' | null
  lastError: string | null
  lastErrorAt: string | null
  /** When false, outbound push is opted out (Settings → Account). */
  pushEnabled: boolean
  pendingPush: SyncPendingPush
  conflicts: number
  currentOperation: string | null
  autoSyncIntervalMinutes: number
  nextSyncAt: string | null
  lastPullStats: SyncPullStats | null
  inboxRemoteId: string | null
}

export interface SyncProgressEvent {
  phase: 'pull' | 'push'
  entityType?: 'folder' | 'project' | 'task'
  current: number
  total: number
  message?: string
}

export interface SyncPullResult {
  ok: boolean
  partial: boolean
  stats: SyncPullStats
  error: string | null
}
