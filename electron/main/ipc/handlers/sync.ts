import type {
  PendingSyncTask,
  SyncProgressEvent,
  SyncPullResult,
  SyncStatusDto,
} from '@shared/sync'
import { getSyncEngine } from '../../sync/SyncEngine'
import { getRepositories } from '../../db/connection'
import { runIpcHandler, runIpcHandlerAsync } from '../ipcWrapper'
import { notifySyncComplete } from '../notify'

export function handleSyncGetStatus() {
  return runIpcHandler((): SyncStatusDto => getSyncEngine().getStatus())
}

export function handleSyncListPendingTasks() {
  return runIpcHandler((): PendingSyncTask[] => getRepositories().tasks.listPendingSyncSummary())
}

export async function handleSyncNow() {
  return runIpcHandlerAsync(async (): Promise<SyncPullResult> => {
    return getSyncEngine().runFullPull()
  })
}

export async function handleSyncPush() {
  return runIpcHandlerAsync(async () => getSyncEngine().runPushIfEnabled())
}

export async function handleSyncFullResetAndPull() {
  return runIpcHandlerAsync(async () => {
    const repos = getRepositories()
    const db = repos.db

    const wipe = db.transaction(() => {
      // Children first (FK-safe), then parents. Inbox project is recreated after wipe.
      // project_sections → projects; tasks.section_id → project_sections (cleared with tasks).
      db.exec(`
        DELETE FROM sticky_notes;
        DELETE FROM task_reminders;
        DELETE FROM task_tags;
        DELETE FROM tasks;
        DELETE FROM project_sections;
        DELETE FROM tags;
        DELETE FROM projects WHERE is_inbox = 0;
        DELETE FROM project_folders;
        DELETE FROM sync_queue;
        UPDATE sync_state SET last_full_sync_at = NULL, inbox_remote_id = NULL, last_error = NULL;
      `)
      repos.projects.ensureInbox()
    })
    wipe()

    notifySyncComplete()

    return getSyncEngine().runFullPull()
  })
}

export type { SyncProgressEvent }
