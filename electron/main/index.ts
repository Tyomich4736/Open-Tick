import { join } from 'path'
import { appendFileSync, mkdirSync } from 'fs'
import { config as loadEnv } from 'dotenv'
import { app, dialog, globalShortcut } from 'electron'
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

/** Must match electron-builder `appId` so Windows toasts show the real app name. */
const APP_ID = 'com.opentick.app'
const APP_DISPLAY_NAME = 'Open Tick'

app.setName(APP_DISPLAY_NAME)
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

// Single instance — prevent silent multi-process launches with no focused window.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showOrCreateMainWindow()
  })
}

loadEnv({ path: join(process.cwd(), '.env') })

function logStartup(message: string, err?: unknown): void {
  const line = `[${new Date().toISOString()}] ${message}${
    err ? ` ${err instanceof Error ? err.stack ?? err.message : String(err)}` : ''
  }\n`
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'startup.log'), line, 'utf8')
  } catch {
    /* ignore */
  }
  console.error(line.trim())
}

async function startApp(): Promise<void> {
  const shouldSeed = !app.isPackaged && process.argv.includes('--seed')

  try {
    initDatabase({ seed: shouldSeed })
    getTokenService()
    registerIpcHandlers()
  } catch (err) {
    logStartup('Fatal during database / IPC init', err)
    dialog.showErrorBox(
      'Open Tick failed to start',
      `Could not open the local database.\n\n${
        err instanceof Error ? err.message : String(err)
      }\n\nIf you built this app on Linux for Windows, rebuild on a Windows machine or ensure the win32 better-sqlite3 prebuild is packaged.\n\nDetails: ${join(
        app.getPath('userData'),
        'startup.log',
      )}`,
    )
    app.quit()
    return
  }

  try {
    createMainWindow()
    createAppTray()
    applyDesktopSettings()
    startReminderScheduler()
    setTimeout(() => {
      try {
        restoreStickyWindows()
      } catch (err) {
        logStartup('restoreStickyWindows failed', err)
      }
    }, 500)
  } catch (err) {
    logStartup('Fatal while creating window', err)
    dialog.showErrorBox(
      'Open Tick failed to open a window',
      err instanceof Error ? err.message : String(err),
    )
    app.quit()
  }

  app.on('activate', () => {
    showOrCreateMainWindow()
  })
}

if (gotLock) {
  app
    .whenReady()
    .then(() => startApp())
    .catch((err) => {
      logStartup('whenReady rejected', err)
      app.quit()
    })
}

app.on('before-quit', () => {
  setAllowQuit(true)
  setStickyAppQuitting(true)
  stopReminderScheduler()
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  if (isMinimizeToTrayEnabled()) return
  app.quit()
})
