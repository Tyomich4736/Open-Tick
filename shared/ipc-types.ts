/// <reference types="electron-vite/node" />

import type { AppearanceSettings, ThemeColors } from './appearance'
import type { AuthStatus } from './auth'
import type {
  BulkTaskPatch,
  ChangeNotification,
  CreateFolderInput,
  CreateProjectInput,
  CreateTagInput,
  CreateTaskInput,
  Project,
  ProjectFolder,
  StickyBoundsPatch,
  StickyNote,
  Tag,
  Task,
  TaskDetail,
  TaskListItem,
  UpdateFolderInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from './entities'
import type { TaskFilter } from './filters'
import type { SyncProgressEvent, SyncPullResult, SyncStatusDto } from './sync'
import type {
  TickTickCredentialsInput,
  TickTickCredentialsPublic,
} from './ticktickCredentials'

export type { AuthStatus } from './auth'
export type { SyncProgressEvent, SyncPullResult, SyncStatusDto } from './sync'
export type { TickTickCredentialsInput, TickTickCredentialsPublic } from './ticktickCredentials'

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
}

export interface TickTickApi {
  ping: () => Promise<IpcResult<'pong'>>
  getVersion: () => Promise<IpcResult<AppInfo>>

  projects: {
    list: () => Promise<IpcResult<Project[]>>
    get: (id: string) => Promise<IpcResult<Project>>
    create: (input: CreateProjectInput) => Promise<IpcResult<Project>>
    update: (id: string, input: UpdateProjectInput) => Promise<IpcResult<Project>>
    delete: (id: string) => Promise<IpcResult<void>>
    reorder: (orderedIds: string[], folderId?: string | null) => Promise<IpcResult<void>>
  }

  folders: {
    list: () => Promise<IpcResult<ProjectFolder[]>>
    create: (input: CreateFolderInput) => Promise<IpcResult<ProjectFolder>>
    update: (id: string, input: UpdateFolderInput) => Promise<IpcResult<ProjectFolder>>
    delete: (id: string) => Promise<IpcResult<void>>
    reorder: (orderedIds: string[]) => Promise<IpcResult<void>>
  }

  tasks: {
    list: (filter?: TaskFilter) => Promise<IpcResult<TaskListItem[]>>
    get: (id: string) => Promise<IpcResult<TaskDetail>>
    create: (input: CreateTaskInput) => Promise<IpcResult<Task>>
    update: (id: string, input: UpdateTaskInput) => Promise<IpcResult<Task>>
    complete: (id: string) => Promise<IpcResult<Task>>
    uncomplete: (id: string) => Promise<IpcResult<Task>>
    reorder: (orderedIds: string[]) => Promise<IpcResult<void>>
    delete: (id: string) => Promise<IpcResult<void>>
    duplicate: (id: string) => Promise<IpcResult<Task>>
    bulkUpdate: (ids: string[], patch: BulkTaskPatch) => Promise<IpcResult<Record<string, string[]>>>
    bulkDelete: (ids: string[]) => Promise<IpcResult<void>>
    bulkComplete: (ids: string[], completed: boolean) => Promise<IpcResult<void>>
    openWindow: (id: string) => Promise<IpcResult<void>>
    closeWindow: (id: string) => Promise<IpcResult<void>>
  }

  stickies: {
    open: (taskId: string) => Promise<IpcResult<StickyNote>>
    close: (taskId: string) => Promise<IpcResult<void>>
    list: () => Promise<IpcResult<StickyNote[]>>
    get: (taskId: string) => Promise<IpcResult<StickyNote | null>>
    updateBounds: (taskId: string, patch: StickyBoundsPatch) => Promise<IpcResult<StickyNote>>
    setPinned: (taskId: string, isPinned: boolean) => Promise<IpcResult<StickyNote>>
  }

  tags: {
    list: () => Promise<IpcResult<Tag[]>>
    create: (input: CreateTagInput) => Promise<IpcResult<Tag>>
  }

  settings: {
    get: <T = unknown>(key: string) => Promise<IpcResult<T>>
    set: (key: string, value: unknown) => Promise<IpcResult<void>>
    getAppearance: () => Promise<IpcResult<AppearanceSettings>>
    setAppearance: (partial: Partial<AppearanceSettings>) => Promise<IpcResult<AppearanceSettings>>
  }

  theme: {
    pickImage: () => Promise<
      IpcResult<{ path: string; colors: ThemeColors; previewDataUrl: string } | null>
    >
    imagePreview: (path: string) => Promise<IpcResult<string | null>>
    clearImage: (path: string | null) => Promise<IpcResult<void>>
    reextract: (
      path: string,
    ) => Promise<IpcResult<{ path: string; colors: ThemeColors; previewDataUrl: string }>>
  }

  auth: {
    status: () => Promise<IpcResult<AuthStatus>>
    connect: () => Promise<IpcResult<AuthStatus>>
    cancelConnect: () => Promise<IpcResult<void>>
    disconnect: () => Promise<IpcResult<void>>
    verify: () => Promise<IpcResult<AuthStatus>>
    getCredentials: () => Promise<IpcResult<TickTickCredentialsPublic>>
    saveCredentials: (
      input: TickTickCredentialsInput,
    ) => Promise<IpcResult<TickTickCredentialsPublic>>
  }

  sync: {
    getStatus: () => Promise<IpcResult<SyncStatusDto>>
    now: () => Promise<IpcResult<SyncPullResult>>
    push: () => Promise<IpcResult<{ ran: boolean; processed: number; errors: string[] }>>
    fullResetAndPull: () => Promise<IpcResult<SyncPullResult>>
  }

  backup: {
    export: () => Promise<IpcResult<{ path: string } | null>>
    restore: () => Promise<IpcResult<{ restarted: boolean } | null>>
  }

  desktop: {
    applySettings: () => Promise<IpcResult<{ errors: string[] }>>
    resetWindow: () => Promise<IpcResult<void>>
    closeQuickCapture: () => Promise<IpcResult<void>>
  }

  onChanged: (callback: (notification: ChangeNotification) => void) => () => void
  onAuthExpired: (callback: (payload: { message: string }) => void) => () => void
  onTaskFocus: (callback: (payload: { taskId: string }) => void) => () => void
  onDesktopNewSticky: (callback: () => void) => () => void
  onDesktopToast: (
    callback: (payload: { type: 'error' | 'info'; message: string }) => void,
  ) => () => void
  onSyncStatusChanged: (callback: (status: SyncStatusDto) => void) => () => void
  onSyncProgress: (callback: (progress: SyncProgressEvent) => void) => () => void
}

declare global {
  interface Window {
    ticktick: TickTickApi
  }
}

export {}
