import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/channels'
import type { TickTickApi } from '@shared/ipc-types'

const api: TickTickApi = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.APP_PING),
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),

  projects: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id),
    reorder: (orderedIds, folderId) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_REORDER, orderedIds, folderId ?? null),
  },

  folders: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.FOLDER_LIST),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.FOLDER_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.FOLDER_UPDATE, id, input),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.FOLDER_DELETE, id),
    reorder: (orderedIds) => ipcRenderer.invoke(IPC_CHANNELS.FOLDER_REORDER, orderedIds),
  },

  tasks: {
    list: (filter) => ipcRenderer.invoke(IPC_CHANNELS.TASK_LIST, filter),
    count: (filter) => ipcRenderer.invoke(IPC_CHANNELS.TASK_COUNT, filter),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_GET, id),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.TASK_CREATE, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.TASK_UPDATE, id, input),
    complete: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_COMPLETE, id),
    uncomplete: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_UNCOMPLETE, id),
    reorder: (orderedIds) => ipcRenderer.invoke(IPC_CHANNELS.TASK_REORDER, orderedIds),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_DELETE, id),
    duplicate: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_DUPLICATE, id),
    bulkUpdate: (ids, patch) => ipcRenderer.invoke(IPC_CHANNELS.TASK_BULK_UPDATE, ids, patch),
    bulkDelete: (ids) => ipcRenderer.invoke(IPC_CHANNELS.TASK_BULK_DELETE, ids),
    bulkComplete: (ids, completed) =>
      ipcRenderer.invoke(IPC_CHANNELS.TASK_BULK_COMPLETE, ids, completed),
    openWindow: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_OPEN_WINDOW, id),
    closeWindow: (id) => ipcRenderer.invoke(IPC_CHANNELS.TASK_CLOSE_WINDOW, id),
  },

  stickies: {
    open: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.STICKY_OPEN, taskId),
    close: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.STICKY_CLOSE, taskId),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.STICKY_LIST),
    get: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.STICKY_GET, taskId),
    updateBounds: (taskId, patch) =>
      ipcRenderer.invoke(IPC_CHANNELS.STICKY_UPDATE_BOUNDS, taskId, patch),
    setPinned: (taskId, isPinned) =>
      ipcRenderer.invoke(IPC_CHANNELS.STICKY_SET_PINNED, taskId, isPinned),
  },

  tags: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TAG_LIST),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.TAG_CREATE, input),
  },

  settings: {
    get: (key) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
    set: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
    getAppearance: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_APPEARANCE),
    setAppearance: (partial) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_APPEARANCE, partial),
  },

  theme: {
    pickImage: () => ipcRenderer.invoke(IPC_CHANNELS.THEME_PICK_IMAGE),
    imagePreview: (path) => ipcRenderer.invoke(IPC_CHANNELS.THEME_IMAGE_PREVIEW, path),
    clearImage: (path) => ipcRenderer.invoke(IPC_CHANNELS.THEME_CLEAR_IMAGE, path),
    reextract: (path) => ipcRenderer.invoke(IPC_CHANNELS.THEME_REEXTRACT, path),
  },

  auth: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS),
    connect: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CONNECT),
    cancelConnect: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CANCEL_CONNECT),
    disconnect: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_DISCONNECT),
    verify: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_VERIFY),
    getCredentials: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_CREDENTIALS),
    saveCredentials: (input) => ipcRenderer.invoke(IPC_CHANNELS.AUTH_SAVE_CREDENTIALS, input),
  },

  sync: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),
    listPendingTasks: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_LIST_PENDING_TASKS),
    now: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_NOW),
    push: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_PUSH),
    fullResetAndPull: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_FULL_RESET_AND_PULL),
  },

  backup: {
    export: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_EXPORT),
    restore: () => ipcRenderer.invoke(IPC_CHANNELS.BACKUP_RESTORE),
  },

  desktop: {
    applySettings: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_APPLY_SETTINGS),
    resetWindow: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_RESET_WINDOW),
    closeQuickCapture: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_CLOSE_QUICK_CAPTURE),
  },

  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, notification: unknown) => {
      callback(notification as Parameters<typeof callback>[0])
    }
    ipcRenderer.on(IPC_CHANNELS.SYNC_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SYNC_CHANGED, listener)
    }
  },

  onAuthExpired: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload as { message: string })
    }
    ipcRenderer.on(IPC_CHANNELS.AUTH_EXPIRED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.AUTH_EXPIRED, listener)
    }
  },

  onTaskFocus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload as { taskId: string })
    }
    ipcRenderer.on(IPC_CHANNELS.TASK_FOCUS, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.TASK_FOCUS, listener)
    }
  },

  onDesktopNewSticky: (callback) => {
    const listener = () => {
      callback()
    }
    ipcRenderer.on(IPC_CHANNELS.DESKTOP_NEW_STICKY, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DESKTOP_NEW_STICKY, listener)
    }
  },

  onDesktopToast: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      callback(payload as { type: 'error' | 'info'; message: string })
    }
    ipcRenderer.on(IPC_CHANNELS.DESKTOP_TOAST, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.DESKTOP_TOAST, listener)
    }
  },

  onSyncStatusChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => {
      callback(status as Parameters<typeof callback>[0])
    }
    ipcRenderer.on(IPC_CHANNELS.SYNC_STATUS_CHANGED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SYNC_STATUS_CHANGED, listener)
    }
  },

  onSyncProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      callback(progress as Parameters<typeof callback>[0])
    }
    ipcRenderer.on(IPC_CHANNELS.SYNC_PROGRESS, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.SYNC_PROGRESS, listener)
    }
  },
}

contextBridge.exposeInMainWorld('ticktick', api)
