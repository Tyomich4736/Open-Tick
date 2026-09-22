import { getRepositories } from '../db/connection'
import { openStickyWindow } from '../windows/stickyNoteWindow'
import { getMainWindowRef, showMainWindow } from './mainWindowRef'
import { IPC_CHANNELS } from '@shared/channels'
import { notifyChanged } from '../ipc/notify'

/** Ask renderer to open sticky for selection, or create inbox task + sticky. */
export function requestNewSticky(): void {
  const main = getMainWindowRef()
  if (main) {
    showMainWindow()
    main.webContents.send(IPC_CHANNELS.DESKTOP_NEW_STICKY)
    return
  }
  createInboxTaskAndOpenSticky()
}

export function createInboxTaskAndOpenSticky(): string {
  const repos = getRepositories()
  const inbox = repos.projects.ensureInbox()
  const task = repos.tasks.create({
    title: 'New sticky note',
    project_id: inbox.id,
  })
  notifyChanged({ entityType: 'task', entityId: task.id, reason: 'local' })
  openStickyWindow(task.id)
  return task.id
}

export function openStickyForTask(taskId: string): void {
  openStickyWindow(taskId)
}
