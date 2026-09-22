export const IPC_CHANNELS = {
  APP_PING: 'app:ping',
  APP_GET_VERSION: 'app:getVersion',

  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_REORDER: 'project:reorder',

  FOLDER_LIST: 'folder:list',
  FOLDER_CREATE: 'folder:create',
  FOLDER_UPDATE: 'folder:update',
  FOLDER_DELETE: 'folder:delete',
  FOLDER_REORDER: 'folder:reorder',

  TASK_LIST: 'task:list',
  TASK_COUNT: 'task:count',
  TASK_GET: 'task:get',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_COMPLETE: 'task:complete',
  TASK_UNCOMPLETE: 'task:uncomplete',
  TASK_REORDER: 'task:reorder',
  TASK_DELETE: 'task:delete',
  TASK_DUPLICATE: 'task:duplicate',
  TASK_BULK_UPDATE: 'task:bulkUpdate',
  TASK_BULK_DELETE: 'task:bulkDelete',
  TASK_BULK_COMPLETE: 'task:bulkComplete',
  TASK_OPEN_WINDOW: 'task:openWindow',
  TASK_CLOSE_WINDOW: 'task:closeWindow',

  STICKY_OPEN: 'sticky:open',
  STICKY_CLOSE: 'sticky:close',
  STICKY_LIST: 'sticky:list',
  STICKY_GET: 'sticky:get',
  STICKY_UPDATE_BOUNDS: 'sticky:updateBounds',
  STICKY_SET_PINNED: 'sticky:setPinned',

  TAG_LIST: 'tag:list',
  TAG_CREATE: 'tag:create',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_APPEARANCE: 'settings:getAppearance',
  SETTINGS_SET_APPEARANCE: 'settings:setAppearance',

  THEME_PICK_IMAGE: 'theme:pickImage',
  THEME_IMAGE_PREVIEW: 'theme:imagePreview',
  THEME_CLEAR_IMAGE: 'theme:clearImage',
  THEME_REEXTRACT: 'theme:reextract',

  AUTH_STATUS: 'auth:status',
  AUTH_CONNECT: 'auth:connect',
  AUTH_CANCEL_CONNECT: 'auth:cancelConnect',
  AUTH_DISCONNECT: 'auth:disconnect',
  AUTH_VERIFY: 'auth:verify',
  AUTH_EXPIRED: 'auth:expired',

  SYNC_CHANGED: 'sync:changed',
  SYNC_GET_STATUS: 'sync:getStatus',
  SYNC_NOW: 'sync:now',
  SYNC_PUSH: 'sync:push',
  SYNC_FULL_RESET_AND_PULL: 'sync:fullResetAndPull',
  SYNC_STATUS_CHANGED: 'sync:status-changed',
  SYNC_PROGRESS: 'sync:progress',

  AUTH_GET_CREDENTIALS: 'auth:getCredentials',
  AUTH_SAVE_CREDENTIALS: 'auth:saveCredentials',

  BACKUP_EXPORT: 'backup:export',
  BACKUP_RESTORE: 'backup:restore',

  DESKTOP_APPLY_SETTINGS: 'desktop:applySettings',
  DESKTOP_RESET_WINDOW: 'desktop:resetWindow',
  DESKTOP_NEW_STICKY: 'desktop:newSticky',
  DESKTOP_TOAST: 'desktop:toast',
  DESKTOP_CLOSE_QUICK_CAPTURE: 'desktop:closeQuickCapture',
  TASK_FOCUS: 'task:focus',
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
