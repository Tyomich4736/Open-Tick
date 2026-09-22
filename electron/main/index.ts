import { join } from 'path'
import { config as loadEnv } from 'dotenv'
import { app, globalShortcut } from 'electron'
import { initDatabase } from './db/connection'
import { registerIpcHandlers } from './ipc/registerHandlers'
import { getTokenService } from './ticktick/TokenService'
import {
  restoreStickyWindows,
  setStickyAppQuitting,
} from './windows/stickyNoteWindow'
import { createMainWindow, setAllowQuit, showOrCreateMainWindow } from './ipc/handlers/desktop'
import { createAppTray } from './tray'
import { applyDesktopSettings, isMinimizeToTrayEnabled } from './desktop/desktopSettings'
import { startReminderScheduler, stopReminderScheduler } from './notifications/reminderScheduler'

loadEnv({ path: join(process.cwd(), '.env') })

app.whenReady().then(() => {
  const shouldSeed = !app.isPackaged && process.argv.includes('--seed')
  initDatabase({ seed: shouldSeed })
  getTokenService()

  registerIpcHandlers()
  createMainWindow()
  createAppTray()
  applyDesktopSettings()
  startReminderScheduler()

  setTimeout(() => restoreStickyWindows(), 500)

  app.on('activate', () => {
    showOrCreateMainWindow()
  })
})

app.on('before-quit', () => {
  setAllowQuit(true)
  setStickyAppQuitting(true)
  stopReminderScheduler()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  // Stay alive for tray when enabled
  if (isMinimizeToTrayEnabled()) return
  app.quit()
})
