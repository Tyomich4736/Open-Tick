function getApi(): Window['ticktick'] {
  if (!window.ticktick) {
    throw new Error('App bridge is not available. Preload script may have failed to load.')
  }
  return window.ticktick
}

export async function ping() {
  return getApi().ping()
}

export async function getVersion() {
  return getApi().getVersion()
}

export const ipc = {
  ping,
  getVersion,
  projects: {
    list: () => getApi().projects.list(),
    get: (id: string) => getApi().projects.get(id),
    create: (input: Parameters<Window['ticktick']['projects']['create']>[0]) =>
      getApi().projects.create(input),
    update: (id: string, input: Parameters<Window['ticktick']['projects']['update']>[1]) =>
      getApi().projects.update(id, input),
    delete: (id: string) => getApi().projects.delete(id),
    reorder: (orderedIds: string[], folderId?: string | null) =>
      getApi().projects.reorder(orderedIds, folderId),
  },
  folders: {
    list: () => getApi().folders.list(),
    create: (input: Parameters<Window['ticktick']['folders']['create']>[0]) =>
      getApi().folders.create(input),
    update: (id: string, input: Parameters<Window['ticktick']['folders']['update']>[1]) =>
      getApi().folders.update(id, input),
    delete: (id: string) => getApi().folders.delete(id),
    reorder: (orderedIds: string[]) => getApi().folders.reorder(orderedIds),
  },
  sections: {
    list: (projectId: string) => getApi().sections.list(projectId),
    create: (input: Parameters<Window['ticktick']['sections']['create']>[0]) =>
      getApi().sections.create(input),
    update: (id: string, input: Parameters<Window['ticktick']['sections']['update']>[1]) =>
      getApi().sections.update(id, input),
    delete: (id: string) => getApi().sections.delete(id),
    reorder: (projectId: string, orderedIds: string[]) =>
      getApi().sections.reorder(projectId, orderedIds),
  },
  tasks: {
    list: (filter?: Parameters<Window['ticktick']['tasks']['list']>[0]) =>
      getApi().tasks.list(filter),
    count: (filter?: Parameters<Window['ticktick']['tasks']['count']>[0]) =>
      getApi().tasks.count(filter),
    get: (id: string) => getApi().tasks.get(id),
    create: (input: Parameters<Window['ticktick']['tasks']['create']>[0]) =>
      getApi().tasks.create(input),
    update: (id: string, input: Parameters<Window['ticktick']['tasks']['update']>[1]) =>
      getApi().tasks.update(id, input),
    complete: (id: string) => getApi().tasks.complete(id),
    uncomplete: (id: string) => getApi().tasks.uncomplete(id),
    reorder: (orderedIds: string[]) => getApi().tasks.reorder(orderedIds),
    delete: (id: string) => getApi().tasks.delete(id),
    duplicate: (id: string) => getApi().tasks.duplicate(id),
    bulkUpdate: (
      ids: string[],
      patch: Parameters<Window['ticktick']['tasks']['bulkUpdate']>[1],
    ) => getApi().tasks.bulkUpdate(ids, patch),
    bulkDelete: (ids: string[]) => getApi().tasks.bulkDelete(ids),
    bulkComplete: (ids: string[], completed: boolean) =>
      getApi().tasks.bulkComplete(ids, completed),
    openWindow: (id: string) => getApi().tasks.openWindow(id),
    closeWindow: (id: string) => getApi().tasks.closeWindow(id),
  },
  stickies: {
    open: (taskId: string) => getApi().stickies.open(taskId),
    close: (taskId: string) => getApi().stickies.close(taskId),
    list: () => getApi().stickies.list(),
    get: (taskId: string) => getApi().stickies.get(taskId),
    updateBounds: (
      taskId: string,
      patch: Parameters<Window['ticktick']['stickies']['updateBounds']>[1],
    ) => getApi().stickies.updateBounds(taskId, patch),
    setPinned: (taskId: string, isPinned: boolean) =>
      getApi().stickies.setPinned(taskId, isPinned),
  },
  tags: {
    list: () => getApi().tags.list(),
    create: (input: Parameters<Window['ticktick']['tags']['create']>[0]) =>
      getApi().tags.create(input),
  },
  settings: {
    get: <T = unknown>(key: string) => getApi().settings.get<T>(key),
    set: (key: string, value: unknown) => getApi().settings.set(key, value),
    getAppearance: () => getApi().settings.getAppearance(),
    setAppearance: (partial: Parameters<Window['ticktick']['settings']['setAppearance']>[0]) =>
      getApi().settings.setAppearance(partial),
  },
  theme: {
    pickImage: () => getApi().theme.pickImage(),
    imagePreview: (path: string) => getApi().theme.imagePreview(path),
    clearImage: (path: string | null) => getApi().theme.clearImage(path),
    reextract: (path: string) => getApi().theme.reextract(path),
  },
  auth: {
    status: () => getApi().auth.status(),
    connect: () => getApi().auth.connect(),
    cancelConnect: () => getApi().auth.cancelConnect(),
    disconnect: () => getApi().auth.disconnect(),
    verify: () => getApi().auth.verify(),
    getCredentials: () => getApi().auth.getCredentials(),
    saveCredentials: (input: Parameters<Window['ticktick']['auth']['saveCredentials']>[0]) =>
      getApi().auth.saveCredentials(input),
  },
  sync: {
    getStatus: () => getApi().sync.getStatus(),
    listPendingTasks: () => getApi().sync.listPendingTasks(),
    now: () => getApi().sync.now(),
    push: () => getApi().sync.push(),
    fullResetAndPull: () => getApi().sync.fullResetAndPull(),
  },
  backup: {
    export: () => getApi().backup.export(),
    restore: () => getApi().backup.restore(),
  },
  desktop: {
    applySettings: () => getApi().desktop.applySettings(),
    resetWindow: () => getApi().desktop.resetWindow(),
    closeQuickCapture: () => getApi().desktop.closeQuickCapture(),
  },
  onChanged: (callback: Parameters<Window['ticktick']['onChanged']>[0]) =>
    getApi().onChanged(callback),
  onAuthExpired: (callback: Parameters<Window['ticktick']['onAuthExpired']>[0]) =>
    getApi().onAuthExpired(callback),
  onTaskFocus: (callback: Parameters<Window['ticktick']['onTaskFocus']>[0]) =>
    getApi().onTaskFocus(callback),
  onDesktopNewSticky: (callback: Parameters<Window['ticktick']['onDesktopNewSticky']>[0]) =>
    getApi().onDesktopNewSticky(callback),
  onDesktopToast: (callback: Parameters<Window['ticktick']['onDesktopToast']>[0]) =>
    getApi().onDesktopToast(callback),
  onSyncStatusChanged: (callback: Parameters<Window['ticktick']['onSyncStatusChanged']>[0]) =>
    getApi().onSyncStatusChanged(callback),
  onSyncProgress: (callback: Parameters<Window['ticktick']['onSyncProgress']>[0]) =>
    getApi().onSyncProgress(callback),
}
