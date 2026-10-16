import { BrowserWindow } from 'electron'
import type { ChangeNotification } from '@shared/entities'
import { IPC_CHANNELS } from '@shared/channels'

export function notifyChanged(notification: ChangeNotification): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.SYNC_CHANGED, notification)
    }
  }
}

/** Single event after pull/push so the renderer invalidates once, not four times. */
export function notifySyncComplete(): void {
  notifyChanged({ entityType: 'all', reason: 'sync' })
}
