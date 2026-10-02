import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** electron-vite bundles main into `out/main/index.js` — always resolve from there. */
export function preloadScriptPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html')
}

function iconCandidates(fileNames: string[]): string[] {
  const roots = app.isPackaged
    ? [process.resourcesPath, join(app.getAppPath(), 'resources'), app.getAppPath()]
    : [join(app.getAppPath(), 'resources'), join(process.cwd(), 'resources')]

  const paths: string[] = []
  for (const root of roots) {
    for (const name of fileNames) {
      paths.push(join(root, name))
    }
  }
  return paths
}

function firstExisting(paths: string[]): string | null {
  for (const path of paths) {
    if (existsSync(path)) return path
  }
  return null
}

/** Window / taskbar icon. Prefer .ico on Windows. */
export function appIconPath(): string {
  const names =
    process.platform === 'win32' ? ['icon.ico', 'icon.png'] : ['icon.png', 'icon.ico']
  const paths = iconCandidates(names)
  return firstExisting(paths) ?? paths[0]!
}

/** System tray icon. Windows needs a real .ico (or shipped PNG); empty = blank tray slot. */
export function trayIconPath(): string {
  const names =
    process.platform === 'win32' ? ['icon.ico', 'icon.png'] : ['icon.png', 'icon.ico']
  const paths = iconCandidates(names)
  return firstExisting(paths) ?? paths[0]!
}
