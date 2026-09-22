import { getRepositories } from '../../db/connection'
import { ipcOk, normalizeError, runIpcHandler } from '../ipcWrapper'
import {
  closeStickyWindow,
  openStickyWindow,
  setStickyPinned,
} from '../../windows/stickyNoteWindow'
import type { StickyBoundsPatch } from '@shared/entities'

export function handleStickyOpen(taskId: string) {
  return runIpcHandler(() => openStickyWindow(taskId))
}

export function handleStickyClose(taskId: string) {
  return runIpcHandler(() => {
    closeStickyWindow(taskId)
  })
}

export function handleStickyList() {
  return runIpcHandler(() => getRepositories().stickies.list())
}

export function handleStickyUpdateBounds(taskId: string, patch: StickyBoundsPatch) {
  return runIpcHandler(() => getRepositories().stickies.updateBounds(taskId, patch))
}

export function handleStickySetPinned(taskId: string, isPinned: boolean) {
  return runIpcHandler(() => setStickyPinned(taskId, isPinned))
}

export function handleStickyGet(taskId: string) {
  try {
    const sticky = getRepositories().stickies.getByTaskId(taskId)
    return ipcOk(sticky)
  } catch (error) {
    return normalizeError(error)
  }
}
