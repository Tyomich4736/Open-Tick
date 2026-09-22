import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/channels'
import { handlePing, handleGetVersion } from './handlers/app'
import {
  handleAuthCancelConnect,
  handleAuthConnect,
  handleAuthDisconnect,
  handleAuthGetCredentials,
  handleAuthSaveCredentials,
  handleAuthStatus,
  handleAuthVerify,
} from './handlers/auth'
import {
  handleSyncFullResetAndPull,
  handleSyncGetStatus,
  handleSyncNow,
  handleSyncPush,
} from './handlers/sync'
import {
  handleFolderCreate,
  handleFolderDelete,
  handleFolderList,
  handleFolderReorder,
  handleFolderUpdate,
  handleProjectCreate,
  handleProjectDelete,
  handleProjectGet,
  handleProjectList,
  handleProjectReorder,
  handleProjectUpdate,
  handleSettingsGet,
  handleSettingsGetAppearance,
  handleSettingsSet,
  handleSettingsSetAppearance,
  handleTagCreate,
  handleTagList,
  handleTaskComplete,
  handleTaskCreate,
  handleTaskDelete,
  handleTaskDuplicate,
  handleTaskBulkComplete,
  handleTaskBulkDelete,
  handleTaskBulkUpdate,
  handleTaskGet,
  handleTaskList,
  handleTaskCount,
  handleTaskReorder,
  handleTaskUncomplete,
  handleTaskUpdate,
} from './handlers/data'
import {
  handleThemeClearImage,
  handleThemeImagePreview,
  handleThemePickImage,
  handleThemeReextract,
} from './handlers/theme'
import {
  handleTaskCloseWindow,
  handleTaskOpenWindow,
} from './handlers/taskWindow'
import {
  handleStickyClose,
  handleStickyGet,
  handleStickyList,
  handleStickyOpen,
  handleStickySetPinned,
  handleStickyUpdateBounds,
} from './handlers/sticky'
import { handleBackupExport, handleBackupRestore } from './handlers/backup'
import {
  handleCloseQuickCapture,
  handleDesktopApplySettings,
  handleDesktopResetWindow,
} from './handlers/desktop'
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_PING, () => handlePing())
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => handleGetVersion())

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, () => handleProjectList())
  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, (_event, id: string) => handleProjectGet(id))
  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, (_event, input) => handleProjectCreate(input))
  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, (_event, id: string, input) =>
    handleProjectUpdate(id, input),
  )
  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, (_event, id: string) => handleProjectDelete(id))
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_REORDER,
    (_event, orderedIds: string[], folderId?: string | null) =>
      handleProjectReorder(orderedIds, folderId ?? null),
  )

  ipcMain.handle(IPC_CHANNELS.FOLDER_LIST, () => handleFolderList())
  ipcMain.handle(IPC_CHANNELS.FOLDER_CREATE, (_event, input) => handleFolderCreate(input))
  ipcMain.handle(IPC_CHANNELS.FOLDER_UPDATE, (_event, id: string, input) =>
    handleFolderUpdate(id, input),
  )
  ipcMain.handle(IPC_CHANNELS.FOLDER_DELETE, (_event, id: string) => handleFolderDelete(id))
  ipcMain.handle(IPC_CHANNELS.FOLDER_REORDER, (_event, orderedIds: string[]) =>
    handleFolderReorder(orderedIds),
  )

  ipcMain.handle(IPC_CHANNELS.TASK_LIST, (_event, filter) => handleTaskList(filter))
  ipcMain.handle(IPC_CHANNELS.TASK_COUNT, (_event, filter) => handleTaskCount(filter))
  ipcMain.handle(IPC_CHANNELS.TASK_GET, (_event, id: string) => handleTaskGet(id))
  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, (_event, input) => handleTaskCreate(input))
  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, (_event, id: string, input) =>
    handleTaskUpdate(id, input),
  )
  ipcMain.handle(IPC_CHANNELS.TASK_COMPLETE, (_event, id: string) => handleTaskComplete(id))
  ipcMain.handle(IPC_CHANNELS.TASK_UNCOMPLETE, (_event, id: string) => handleTaskUncomplete(id))
  ipcMain.handle(IPC_CHANNELS.TASK_REORDER, (_event, orderedIds: string[]) =>
    handleTaskReorder(orderedIds),
  )
  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, (_event, id: string) => handleTaskDelete(id))
  ipcMain.handle(IPC_CHANNELS.TASK_DUPLICATE, (_event, id: string) => handleTaskDuplicate(id))
  ipcMain.handle(IPC_CHANNELS.TASK_BULK_UPDATE, (_event, ids: string[], patch) =>
    handleTaskBulkUpdate(ids, patch),
  )
  ipcMain.handle(IPC_CHANNELS.TASK_BULK_DELETE, (_event, ids: string[]) =>
    handleTaskBulkDelete(ids),
  )
  ipcMain.handle(IPC_CHANNELS.TASK_BULK_COMPLETE, (_event, ids: string[], completed: boolean) =>
    handleTaskBulkComplete(ids, completed),
  )
  ipcMain.handle(IPC_CHANNELS.TASK_OPEN_WINDOW, (event, id: string) =>
    handleTaskOpenWindow(event, id),
  )
  ipcMain.handle(IPC_CHANNELS.TASK_CLOSE_WINDOW, (_event, id: string) =>
    handleTaskCloseWindow(id),
  )

  ipcMain.handle(IPC_CHANNELS.STICKY_OPEN, (_event, taskId: string) => handleStickyOpen(taskId))
  ipcMain.handle(IPC_CHANNELS.STICKY_CLOSE, (_event, taskId: string) => handleStickyClose(taskId))
  ipcMain.handle(IPC_CHANNELS.STICKY_LIST, () => handleStickyList())
  ipcMain.handle(IPC_CHANNELS.STICKY_GET, (_event, taskId: string) => handleStickyGet(taskId))
  ipcMain.handle(IPC_CHANNELS.STICKY_UPDATE_BOUNDS, (_event, taskId: string, patch) =>
    handleStickyUpdateBounds(taskId, patch),
  )
  ipcMain.handle(IPC_CHANNELS.STICKY_SET_PINNED, (_event, taskId: string, isPinned: boolean) =>
    handleStickySetPinned(taskId, isPinned),
  )

  ipcMain.handle(IPC_CHANNELS.TAG_LIST, () => handleTagList())
  ipcMain.handle(IPC_CHANNELS.TAG_CREATE, (_event, input) => handleTagCreate(input))

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key: string) => handleSettingsGet(key))
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: unknown) =>
    handleSettingsSet(key, value),
  )
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_APPEARANCE, () => handleSettingsGetAppearance())
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_APPEARANCE, (_event, partial) =>
    handleSettingsSetAppearance(partial),
  )

  ipcMain.handle(IPC_CHANNELS.THEME_PICK_IMAGE, (event) => handleThemePickImage(event))
  ipcMain.handle(IPC_CHANNELS.THEME_IMAGE_PREVIEW, (_event, path: string) =>
    handleThemeImagePreview(path),
  )
  ipcMain.handle(IPC_CHANNELS.THEME_CLEAR_IMAGE, (_event, path: string | null) =>
    handleThemeClearImage(path),
  )
  ipcMain.handle(IPC_CHANNELS.THEME_REEXTRACT, (_event, path: string) =>
    handleThemeReextract(path),
  )

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, () => handleAuthStatus())
  ipcMain.handle(IPC_CHANNELS.AUTH_CONNECT, () => handleAuthConnect())
  ipcMain.handle(IPC_CHANNELS.AUTH_CANCEL_CONNECT, () => handleAuthCancelConnect())
  ipcMain.handle(IPC_CHANNELS.AUTH_DISCONNECT, () => handleAuthDisconnect())
  ipcMain.handle(IPC_CHANNELS.AUTH_VERIFY, () => handleAuthVerify())
  ipcMain.handle(IPC_CHANNELS.AUTH_GET_CREDENTIALS, () => handleAuthGetCredentials())
  ipcMain.handle(IPC_CHANNELS.AUTH_SAVE_CREDENTIALS, (_event, input) =>
    handleAuthSaveCredentials(_event, input),
  )

  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, () => handleSyncGetStatus())
  ipcMain.handle(IPC_CHANNELS.SYNC_NOW, () => handleSyncNow())
  ipcMain.handle(IPC_CHANNELS.SYNC_PUSH, () => handleSyncPush())
  ipcMain.handle(IPC_CHANNELS.SYNC_FULL_RESET_AND_PULL, () => handleSyncFullResetAndPull())

  ipcMain.handle(IPC_CHANNELS.BACKUP_EXPORT, (event) => handleBackupExport(event))
  ipcMain.handle(IPC_CHANNELS.BACKUP_RESTORE, (event) => handleBackupRestore(event))

  ipcMain.handle(IPC_CHANNELS.DESKTOP_APPLY_SETTINGS, () => handleDesktopApplySettings())
  ipcMain.handle(IPC_CHANNELS.DESKTOP_RESET_WINDOW, () => handleDesktopResetWindow())
  ipcMain.handle(IPC_CHANNELS.DESKTOP_CLOSE_QUICK_CAPTURE, () => handleCloseQuickCapture())
}
