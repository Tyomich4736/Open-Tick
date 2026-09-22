import { net } from 'electron'

/**
 * Sync engine — inbound pull (Phase 13) + outbound push (Phase 14).
 * Push is gated behind Settings → `sync.push_enabled` (default false).
 */
import type { SyncStatusDto, SyncProgressEvent, SyncPullResult } from '@shared/sync'
import { TICKTICK_SETTING_KEYS } from '@shared/ticktickCredentials'
import { getRepositories } from '../db/connection'
import { SyncStateRepository } from '../db/repositories/SyncStateRepository'
import { notifyChanged } from '../ipc/notify'
import { IPC_CHANNELS } from '@shared/channels'
import { BrowserWindow } from 'electron'
import { remoteFolderToLocal, remoteProjectToLocal, remoteTaskToLocal } from './mappers'
import { getTickTickClient, TickTickApiError } from '../ticktick/TickTickClient'
import { pushDirtyEntities, type PushResult } from './pushDirty'
import { getTokenService } from '../ticktick/TokenService'
import { getTickTickConfig, isOAuthConfigured } from '../ticktick/config'

function emitToRenderers(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class SyncEngine {
  private pullPromise: Promise<SyncPullResult> | null = null
  private pushPromise: Promise<PushResult> | null = null
  private currentOperation: string | null = null
  private lastPullResult: SyncStatusDto['lastSyncResult'] = null
  private lastErrorAt: string | null = null
  private lastPullStats: SyncStatusDto['lastPullStats'] = null

  private syncState(): SyncStateRepository {
    return new SyncStateRepository(getRepositories().db)
  }

  private loadPersistedMeta(): void {
    const settings = getRepositories().settings
    this.lastPullResult =
      (settings.get<SyncStatusDto['lastSyncResult']>(TICKTICK_SETTING_KEYS.lastPullResult) as
        | SyncStatusDto['lastSyncResult']
        | null) ?? null
    this.lastErrorAt = settings.get<string>(TICKTICK_SETTING_KEYS.lastErrorAt)
    this.lastPullStats =
      settings.get<SyncStatusDto['lastPullStats']>(TICKTICK_SETTING_KEYS.lastPullStats) ?? null
  }

  private persistMeta(): void {
    const settings = getRepositories().settings
    settings.set(TICKTICK_SETTING_KEYS.lastPullResult, this.lastPullResult)
    settings.set(TICKTICK_SETTING_KEYS.lastErrorAt, this.lastErrorAt)
    settings.set(TICKTICK_SETTING_KEYS.lastPullStats, this.lastPullStats)
  }

  getStatus(): SyncStatusDto {
    this.loadPersistedMeta()
    const tokens = getTokenService()
    const state = this.syncState().get()
    const config = getTickTickConfig()
    const accountLabel =
      getRepositories().settings.get<string>(TICKTICK_SETTING_KEYS.accountLabel) ??
      (tokens.usingPat() ? 'Personal access token' : tokens.isConnected() ? 'TickTick account' : null)

    const autoSync =
      getRepositories().settings.get<number>('sync_interval_minutes') ?? 3

    return {
      isConnected: tokens.isConnected(),
      configured: isOAuthConfigured(config) || Boolean(config.accessTokenPat),
      accountLabel,
      isOnline: net.isOnline(),
      isSyncing: state.is_syncing || Boolean(this.pullPromise) || Boolean(this.pushPromise),
      lastSyncAt: state.last_full_sync_at,
      lastSyncResult: this.lastPullResult,
      lastError: state.last_error,
      lastErrorAt: this.lastErrorAt,
      pushEnabled:
        getRepositories().settings.get<boolean>(TICKTICK_SETTING_KEYS.pushEnabled) === true,
      pendingPush: this.getPendingPushCounts(),
      conflicts: 0,
      currentOperation: this.currentOperation,
      autoSyncIntervalMinutes: autoSync,
      nextSyncAt: null,
      lastPullStats: this.lastPullStats,
      inboxRemoteId: state.inbox_remote_id,
    }
  }

  broadcastStatus(): void {
    emitToRenderers(IPC_CHANNELS.SYNC_STATUS_CHANGED, this.getStatus())
  }

  private getPendingPushCounts(): SyncStatusDto['pendingPush'] {
    const zero = { total: 0, tasks: 0, projects: 0, folders: 0 }
    try {
      const db = getRepositories().db

      const queueRows = db
        .prepare(`SELECT entity_type, COUNT(*) as c FROM sync_queue GROUP BY entity_type`)
        .all() as Array<{ entity_type: string; c: number }>
      const qByType = Object.fromEntries(queueRows.map((r) => [r.entity_type, r.c]))

      const getCount = (sql: string) => {
        const row = db.prepare(sql).get() as { c: number } | undefined
        return row?.c ?? 0
      }

      const dirtyTasks = getCount(`SELECT COUNT(*) as c FROM tasks WHERE sync_status LIKE 'pending_%'`)
      const dirtyProjects = getCount(`SELECT COUNT(*) as c FROM projects WHERE sync_status LIKE 'pending_%' AND is_inbox = 0`)
      const dirtyFolders = getCount(`SELECT COUNT(*) as c FROM project_folders WHERE sync_status LIKE 'pending_%'`)

      const tasks = (qByType.task ?? 0) + dirtyTasks
      const projects = (qByType.project ?? 0) + dirtyProjects
      const folders = (qByType.folder ?? 0) + dirtyFolders

      return { total: tasks + projects + folders, tasks, projects, folders }
    } catch (e) {
      console.warn('[sync] getPendingPushCounts failed:', e)
      return zero
    }
  }

  private setProgress(progress: SyncProgressEvent): void {
    this.currentOperation = progress.message ?? null
    emitToRenderers(IPC_CHANNELS.SYNC_PROGRESS, progress)
    this.broadcastStatus()
  }

  async runFullPull(): Promise<SyncPullResult> {
    if (this.pullPromise) return this.pullPromise
    this.pullPromise = this.executeFullPull().finally(() => {
      this.pullPromise = null
      this.currentOperation = null
      this.broadcastStatus()
    })
    return this.pullPromise
  }

  /**
   * Outbound push — requires Settings → Enable push to TickTick.
   * Processes dirty pending_* folders, projects, and tasks.
   */
  async runPushIfEnabled(): Promise<PushResult> {
    const enabled =
      getRepositories().settings.get<boolean>(TICKTICK_SETTING_KEYS.pushEnabled) === true

    if (!enabled) {
      return {
        ran: false,
        processed: 0,
        errors: ['Push is disabled (enable in Settings → Account)'],
      }
    }

    if (this.pullPromise || this.pushPromise) {
      return {
        ran: false,
        processed: 0,
        errors: ['Sync already in progress'],
      }
    }

    const tokens = getTokenService()
    if (!tokens.isConnected()) {
      return { ran: false, processed: 0, errors: ['Not connected to TickTick'] }
    }
    if (!net.isOnline()) {
      return { ran: false, processed: 0, errors: ['You are offline'] }
    }

    this.pushPromise = this.executePush().finally(() => {
      this.pushPromise = null
      this.currentOperation = null
      this.broadcastStatus()
    })
    return this.pushPromise
  }

  private async executePush(): Promise<PushResult> {
    const stateRepo = this.syncState()
    stateRepo.setSyncing(true)
    this.broadcastStatus()

    try {
      const result = await pushDirtyEntities((message, current, total) => {
        this.setProgress({
          phase: 'push',
          current,
          total,
          message,
        })
      })

      if (result.errors.length) {
        const warning = result.errors.slice(0, 3).join(' · ')
        stateRepo.markError(warning)
        this.lastErrorAt = new Date().toISOString()
      } else {
        getRepositories().db
          .prepare('UPDATE sync_state SET is_syncing = 0, last_error = NULL WHERE id = 1')
          .run()
      }

      notifyChanged({ entityType: 'folder', reason: 'sync' })
      notifyChanged({ entityType: 'project', reason: 'sync' })
      notifyChanged({ entityType: 'task', reason: 'sync' })

      this.persistMeta()
      this.broadcastStatus()
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push failed'
      stateRepo.markError(message)
      this.lastErrorAt = new Date().toISOString()
      this.persistMeta()
      this.broadcastStatus()

      if (error instanceof TickTickApiError && error.status === 401) {
        emitToRenderers(IPC_CHANNELS.AUTH_EXPIRED, { message })
      }

      return { ran: true, processed: 0, errors: [message] }
    } finally {
      try {
        stateRepo.setSyncing(false)
      } catch {
        /* ignore */
      }
    }
  }

  private async executeFullPull(): Promise<SyncPullResult> {
    const tokens = getTokenService()
    if (!tokens.isConnected()) {
      throw new Error('Not connected to TickTick')
    }
    if (!net.isOnline()) {
      throw new Error('You are offline')
    }

    const repos = getRepositories()
    const stateRepo = this.syncState()
    const client = getTickTickClient()
    client.refreshConfig()

    stateRepo.setSyncing(true)
    this.broadcastStatus()

    const stats = { folders: 0, projects: 0, tasks: 0, skippedDirty: 0 }
    let partial = false
    const pullErrors: string[] = []

    try {
      this.setProgress({
        phase: 'pull',
        current: 0,
        total: 1,
        message: 'Pulling folders…',
      })

      const groups = await client.listProjectGroups()
      const folderIdByRemote = new Map<string, string>()
      for (const group of groups) {
        const mapped = remoteFolderToLocal(group)
        const folder = repos.folders.upsertFromRemote(mapped)
        folderIdByRemote.set(mapped.remote_id, folder.id)
        stats.folders += 1
      }

      this.setProgress({
        phase: 'pull',
        entityType: 'project',
        current: 0,
        total: 1,
        message: 'Pulling lists…',
      })

      const remoteProjects = await client.listProjects()
      const projectIdByRemote = new Map<string, string>()

      // Ensure inbox exists locally
      const inbox = repos.projects.ensureInbox()
      if (inbox.remote_id) projectIdByRemote.set(inbox.remote_id, inbox.id)

      for (const remote of remoteProjects) {
        if (remote.closed) continue
        const mapped = remoteProjectToLocal(remote)
        const folderId = mapped.group_remote_id
          ? folderIdByRemote.get(mapped.group_remote_id) ?? null
          : null
        const project = repos.projects.upsertFromRemote({
          ...mapped,
          folder_id: folderId,
        })
        projectIdByRemote.set(mapped.remote_id, project.id)
        stats.projects += 1
      }

      // Inbox data
      this.setProgress({
        phase: 'pull',
        entityType: 'task',
        current: 0,
        total: remoteProjects.length + 1,
        message: 'Pulling Inbox…',
      })

      try {
        const inboxData = await client.getInboxData()
        const inboxTasks = inboxData.tasks ?? []
        let inboxRemoteId = stateRepo.get().inbox_remote_id
        if (!inboxRemoteId && inboxTasks[0]?.projectId) {
          inboxRemoteId = inboxTasks[0].projectId
        }
        if (!inboxRemoteId && inboxData.project?.id) {
          inboxRemoteId = inboxData.project.id
        }
        if (inboxRemoteId) {
          repos.projects.setInboxRemoteId(inboxRemoteId)
          stateRepo.setInboxRemoteId(inboxRemoteId)
          projectIdByRemote.set(inboxRemoteId, repos.projects.ensureInbox().id)
        }
        const inboxTaskList = Array.isArray(inboxTasks) ? inboxTasks : []
        stats.tasks += this.upsertTaskBatch(
          inboxTaskList,
          projectIdByRemote,
          stats,
          inboxRemoteId ?? undefined,
        )
      } catch (error) {
        partial = true
        const msg = error instanceof Error ? error.message : String(error)
        pullErrors.push(`Inbox: ${msg}`)
        console.warn('[sync] inbox pull failed', error)
      }

      let index = 0
      for (const remote of remoteProjects) {
        if (remote.closed) continue
        index += 1
        this.setProgress({
          phase: 'pull',
          entityType: 'task',
          current: index,
          total: remoteProjects.length,
          message: `Pulling lists (${index}/${remoteProjects.length})`,
        })
        try {
          const data = await client.getProjectData(remote.id)
          const tasks = Array.isArray(data?.tasks) ? data.tasks : []
          stats.tasks += this.upsertTaskBatch(tasks, projectIdByRemote, stats, remote.id)
        } catch (error) {
          partial = true
          const msg = error instanceof Error ? error.message : String(error)
          pullErrors.push(`${remote.name ?? remote.id}: ${msg}`)
          console.warn(`[sync] project ${remote.id} pull failed`, error)
        }
        await sleep(200)
      }

      const warning =
        partial && pullErrors.length ? pullErrors.slice(0, 3).join(' · ') : null
      stateRepo.markFullSyncSuccess({ warning })
      this.lastPullResult = partial ? 'partial' : 'success'
      this.lastErrorAt = warning ? new Date().toISOString() : null
      this.lastPullStats = stats
      this.persistMeta()

      // Soft verification label
      getTokenService().setVerification(remoteProjects.length)
      repos.settings.set(
        TICKTICK_SETTING_KEYS.accountLabel,
        tokens.usingPat() ? 'Personal access token' : 'TickTick account',
      )

      notifyChanged({ entityType: 'folder', reason: 'sync' })
      notifyChanged({ entityType: 'project', reason: 'sync' })
      notifyChanged({ entityType: 'task', reason: 'sync' })
      notifyChanged({ entityType: 'tag', reason: 'sync' })

      const result: SyncPullResult = {
        ok: true,
        partial,
        stats,
        error: null,
      }
      this.broadcastStatus()
      return result
    } catch (error) {
      const message =
        error instanceof TickTickApiError || error instanceof Error
          ? error.message
          : 'Pull failed'
      stateRepo.markError(message)
      this.lastPullResult = 'failed'
      this.lastErrorAt = new Date().toISOString()
      this.persistMeta()
      this.broadcastStatus()

      if (error instanceof TickTickApiError && error.status === 401) {
        emitToRenderers(IPC_CHANNELS.AUTH_EXPIRED, { message })
      }

      throw error instanceof Error ? error : new Error(message)
    }
  }

  private upsertTaskBatch(
    remotes: import('../ticktick/remoteTypes').RemoteTask[],
    projectIdByRemote: Map<string, string>,
    stats: { skippedDirty: number },
    /** Fallback when a task omits projectId (scoped project/inbox fetch). */
    fallbackProjectRemoteId?: string,
  ): number {
    const repos = getRepositories()
    const mappedList = remotes.map(remoteTaskToLocal)

    // Parents before children (rough: null parent first, then others — two passes)
    const ordered = [
      ...mappedList.filter((t) => !t.parent_remote_id),
      ...mappedList.filter((t) => t.parent_remote_id),
    ]

    let count = 0
    const remoteToLocalTask = new Map<string, string>()

    // Seed map with existing remote tasks
    for (const m of ordered) {
      const existing = repos.tasks.getByRemoteId(m.remote_id)
      if (existing) remoteToLocalTask.set(m.remote_id, existing.id)
    }

    for (const m of ordered) {
      const projectId =
        projectIdByRemote.get(m.project_remote_id) ??
        (fallbackProjectRemoteId
          ? projectIdByRemote.get(fallbackProjectRemoteId)
          : undefined)
      if (!projectId) {
        console.warn(
          '[sync] skip task without local list',
          m.remote_id,
          m.project_remote_id,
        )
        continue
      }

      const existing = repos.tasks.getByRemoteId(m.remote_id)
      if (existing && existing.sync_status !== 'synced') {
        stats.skippedDirty += 1
        continue
      }

      let parentId: string | null = null
      if (m.parent_remote_id) {
        parentId =
          remoteToLocalTask.get(m.parent_remote_id) ??
          repos.tasks.getByRemoteId(m.parent_remote_id)?.id ??
          null
      }

      const task = repos.tasks.upsertFromRemote({
        remote_id: m.remote_id,
        project_id: projectId,
        parent_id: parentId,
        title: m.title,
        content: m.content,
        priority: m.priority,
        status: m.status,
        due_date: m.due_date,
        start_date: m.start_date,
        is_all_day: m.is_all_day,
        time_zone: m.time_zone,
        recurrence_rule: m.recurrence_rule,
        sort_order: m.sort_order,
        remote_updated_at: m.remote_updated_at,
        completed_at: m.completed_at,
        tags: m.tags,
        reminders: m.reminders,
      })
      remoteToLocalTask.set(m.remote_id, task.id)
      count += 1
    }
    return count
  }
}

let engine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!engine) engine = new SyncEngine()
  return engine
}

export function resetSyncEngineForTests(): void {
  engine = null
}
