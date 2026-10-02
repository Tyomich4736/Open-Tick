import { app, dialog, BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { copyFileSync, existsSync } from 'node:fs'
import { closeDatabase, getDbPath, getRepositories, initDatabase } from '../../db/connection'
import { runIpcHandlerAsync } from '../ipcWrapper'
import type { IpcResult } from '@shared/ipc-types'

export async function handleBackupExport(
  event: IpcMainInvokeEvent,
): Promise<IpcResult<{ path: string } | null>> {
  return runIpcHandlerAsync(async () => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.SaveDialogOptions = {
      title: 'Export database backup',
      defaultPath: `opentick-backup-${new Date().toISOString().slice(0, 10)}.db`,
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
    }
    const result = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null

    const dbPath = getDbPath()
    const repos = getRepositories()
    try {
      repos.db.exec(`VACUUM INTO '${result.filePath.replace(/'/g, "''")}'`)
    } catch {
      copyFileSync(dbPath, result.filePath)
    }
    return { path: result.filePath }
  })
}

export async function handleBackupRestore(
  event: IpcMainInvokeEvent,
): Promise<IpcResult<{ restarted: boolean } | null>> {
  return runIpcHandlerAsync(async () => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const messageOptions: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['Cancel', 'Choose backup…'],
      defaultId: 0,
      cancelId: 0,
      title: 'Restore backup',
      message: 'Restore will replace your current local database and restart the app.',
      detail: 'Unsynced changes in the current database may be lost.',
    }
    const confirm = win
      ? await dialog.showMessageBox(win, messageOptions)
      : await dialog.showMessageBox(messageOptions)
    if (confirm.response !== 1) return null

    const openOptions: Electron.OpenDialogOptions = {
      title: 'Choose backup file',
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
      properties: ['openFile'],
    }
    const pick = win
      ? await dialog.showOpenDialog(win, openOptions)
      : await dialog.showOpenDialog(openOptions)
    if (pick.canceled || !pick.filePaths[0]) return null

    const source = pick.filePaths[0]
    if (!existsSync(source)) throw new Error('Backup file not found')

    const target = getDbPath()
    closeDatabase()
    copyFileSync(source, target)
    initDatabase()

    setTimeout(() => {
      app.relaunch()
      app.exit(0)
    }, 250)

    return { restarted: true }
  })
}
