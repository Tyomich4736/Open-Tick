import { BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import {
  deleteThemeImage,
  extractPaletteFromImage,
  loadThemeImagePreview,
  pickAndStoreThemeImage,
} from '../../appearance/themeImage'
import { ipcOk, normalizeError, runIpcHandler } from '../ipcWrapper'

/** Must be async — dialog + nativeImage work cannot be returned as a nested Promise over IPC. */
export async function handleThemePickImage(event: IpcMainInvokeEvent) {
  try {
    const win = BrowserWindow.fromWebContents(event.sender)
    const picked = await pickAndStoreThemeImage(win)
    if (!picked) return ipcOk(null)

    // Plain JSON only — Electron structured-clone rejects Promises / native handles
    return ipcOk({
      path: String(picked.path),
      colors: { ...picked.colors },
      previewDataUrl: String(picked.previewDataUrl ?? ''),
    })
  } catch (error) {
    return normalizeError(error)
  }
}

export function handleThemeImagePreview(path: string) {
  return runIpcHandler(() => loadThemeImagePreview(path))
}

export function handleThemeClearImage(path: string | null) {
  return runIpcHandler(() => {
    deleteThemeImage(path)
  })
}

export function handleThemeReextract(path: string) {
  return runIpcHandler(() => {
    if (!path) throw new Error('No theme image path')
    const colors = extractPaletteFromImage(path)
    const previewDataUrl = loadThemeImagePreview(path) ?? ''
    return {
      path: String(path),
      colors: { ...colors },
      previewDataUrl: String(previewDataUrl),
    }
  })
}
