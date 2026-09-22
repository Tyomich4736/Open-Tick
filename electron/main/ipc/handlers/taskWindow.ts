import { BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { closeTaskWindow, openTaskWindow, setTaskWindowTitle } from '../../windows/taskWindow'
import { getRepositories } from '../../db/connection'
import { ipcOk, normalizeError, runIpcHandler } from '../ipcWrapper'

export async function handleTaskOpenWindow(event: IpcMainInvokeEvent, taskId: string) {
  try {
    const task = getRepositories().tasks.getById(taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)
    openTaskWindow(taskId, task.title)
    // Keep main window reference if needed later
    void BrowserWindow.fromWebContents(event.sender)
    return ipcOk(undefined)
  } catch (error) {
    return normalizeError(error)
  }
}

export function handleTaskCloseWindow(taskId: string) {
  return runIpcHandler(() => {
    closeTaskWindow(taskId)
  })
}

export function handleTaskSetWindowTitle(taskId: string, title: string) {
  return runIpcHandler(() => {
    setTaskWindowTitle(taskId, title)
  })
}
