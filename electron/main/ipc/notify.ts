import { BrowserWindow } from 'electron'
import type { ChangeNotification } from '@shared/entities'
import { IPC_CHANNELS } from '@shared/channels'

export function setMainWindow(_window: BrowserWindow | null): void {
  // Kept for API stability; sync broadcasts to all windows.
}

export function notifyChanged(notification: ChangeNotification): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.SYNC_CHANGED, notification)
    }
  }
}
