import { join } from 'node:path'
import { app } from 'electron'

/** electron-vite bundles main into `out/main/index.js` — always resolve from there. */
export function preloadScriptPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html')
}

export function appIconPath(): string {
  // Packaged: resources live next to the executable; cwd is unreliable on Windows.
  if (app.isPackaged) {
    return join(process.resourcesPath, 'icon.png')
  }
  return join(app.getAppPath(), 'resources', 'icon.png')
}
