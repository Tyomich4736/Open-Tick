import { join } from 'node:path'

/** electron-vite bundles main into `out/main/index.js` — always resolve from there. */
export function preloadScriptPath(): string {
  return join(__dirname, '../preload/index.js')
}

export function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html')
}

export function appIconPath(): string {
  return join(process.cwd(), 'resources', 'icon.png')
}
