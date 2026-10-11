import { create } from 'zustand'
import type { ThemeMode } from '@shared/appearance'

export type { ThemeMode }

export type ContextMenuState =
  | { type: 'folder'; id: string; x: number; y: number }
  | { type: 'project'; id: string; x: number; y: number }
  | { type: 'smart'; path: string; label: string; x: number; y: number }
  | { type: 'task'; id: string; x: number; y: number }

interface UiState {
  expandedTaskIds: Record<string, boolean>
  toggleExpanded: (id: string, currentlyExpanded: boolean) => void
  setTaskExpanded: (id: string, expanded: boolean) => void
  projectModalOpen: boolean
  editingProjectId: string | null
  defaultFolderId: string | null
  openProjectModal: (projectId?: string | null, folderId?: string | null) => void
  closeProjectModal: () => void
  folderModalOpen: boolean
  editingFolderId: string | null
  openFolderModal: (folderId?: string | null) => void
  closeFolderModal: () => void
  contextMenu: ContextMenuState | null
  setContextMenu: (menu: ContextMenuState | null) => void
  quickAddFocusToken: number
  focusQuickAdd: () => void
  focusSubtaskAddToken: number
  focusSubtaskAdd: () => void
  integrationPanelOpen: boolean
  setIntegrationPanelOpen: (open: boolean) => void
  toggleIntegrationPanel: () => void
}

export const useUiStore = create<UiState>((set) => ({
  expandedTaskIds: {},
  toggleExpanded: (id, currentlyExpanded) =>
    set((state) => ({
      expandedTaskIds: {
        ...state.expandedTaskIds,
        [id]: !currentlyExpanded,
      },
    })),
  setTaskExpanded: (id, expanded) =>
    set((state) => ({
      expandedTaskIds: {
        ...state.expandedTaskIds,
        [id]: expanded,
      },
    })),
  projectModalOpen: false,
  editingProjectId: null,
  defaultFolderId: null,
  openProjectModal: (projectId = null, folderId = null) =>
    set({
      projectModalOpen: true,
      editingProjectId: projectId,
      defaultFolderId: folderId,
    }),
  closeProjectModal: () =>
    set({ projectModalOpen: false, editingProjectId: null, defaultFolderId: null }),
  folderModalOpen: false,
  editingFolderId: null,
  openFolderModal: (folderId = null) =>
    set({ folderModalOpen: true, editingFolderId: folderId }),
  closeFolderModal: () => set({ folderModalOpen: false, editingFolderId: null }),
  contextMenu: null,
  setContextMenu: (menu) => set({ contextMenu: menu }),
  quickAddFocusToken: 0,
  focusQuickAdd: () =>
    set((state) => ({ quickAddFocusToken: state.quickAddFocusToken + 1 })),
  focusSubtaskAddToken: 0,
  focusSubtaskAdd: () =>
    set((state) => ({ focusSubtaskAddToken: state.focusSubtaskAddToken + 1 })),
  integrationPanelOpen: false,
  setIntegrationPanelOpen: (open) => set({ integrationPanelOpen: open }),
  toggleIntegrationPanel: () =>
    set((state) => ({ integrationPanelOpen: !state.integrationPanelOpen })),
}))
