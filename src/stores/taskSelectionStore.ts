import { create } from 'zustand'
import { useUiStore } from '@/stores/uiStore'

function syncSelectedTaskId(selectedIds: string[]) {
  useUiStore
    .getState()
    .setSelectedTaskId(selectedIds.length === 1 ? selectedIds[0]! : null)
}

interface TaskSelectionState {
  selectedIds: string[]
  anchorId: string | null
  /** Survives TaskList filter resets (prefs load, route change) until user dismisses. */
  pendingSelectId: string | null
  selectOne: (id: string) => void
  /** Open a task and keep it selected across list remounts / filter churn. */
  openTask: (id: string) => void
  toggle: (id: string) => void
  rangeTo: (id: string, orderedIds: string[]) => void
  clear: () => void
  /** Re-apply pending selection after a filter change; otherwise clear. */
  onListFilterChange: () => void
  setMany: (ids: string[]) => void
  isSelected: (id: string) => boolean
}

export const useTaskSelectionStore = create<TaskSelectionState>((set, get) => ({
  selectedIds: [],
  anchorId: null,
  pendingSelectId: null,

  selectOne: (id) => {
    const selectedIds = [id]
    set({ selectedIds, anchorId: id, pendingSelectId: null })
    syncSelectedTaskId(selectedIds)
  },

  openTask: (id) => {
    const selectedIds = [id]
    set({ selectedIds, anchorId: id, pendingSelectId: id })
    syncSelectedTaskId(selectedIds)
  },

  toggle: (id) => {
    const prev = get().selectedIds
    const has = prev.includes(id)
    const selectedIds = has ? prev.filter((x) => x !== id) : [...prev, id]
    const anchorId = has
      ? selectedIds[selectedIds.length - 1] ?? null
      : id
    set({ selectedIds, anchorId, pendingSelectId: null })
    syncSelectedTaskId(selectedIds)
  },

  rangeTo: (id, orderedIds) => {
    const { anchorId, selectedIds } = get()
    const startId = anchorId ?? selectedIds[0] ?? id
    const start = orderedIds.indexOf(startId)
    const end = orderedIds.indexOf(id)
    if (start < 0 || end < 0) {
      get().selectOne(id)
      return
    }
    const [lo, hi] = start <= end ? [start, end] : [end, start]
    const next = orderedIds.slice(lo, hi + 1)
    set({ selectedIds: next, anchorId: startId, pendingSelectId: null })
    syncSelectedTaskId(next)
  },

  clear: () => {
    set({ selectedIds: [], anchorId: null, pendingSelectId: null })
    syncSelectedTaskId([])
  },

  onListFilterChange: () => {
    const pending = get().pendingSelectId
    if (pending) {
      const selectedIds = [pending]
      set({ selectedIds, anchorId: pending })
      syncSelectedTaskId(selectedIds)
      return
    }
    set({ selectedIds: [], anchorId: null })
    syncSelectedTaskId([])
  },

  setMany: (ids) => {
    const selectedIds = [...new Set(ids)]
    set({
      selectedIds,
      anchorId: selectedIds[selectedIds.length - 1] ?? null,
      pendingSelectId: null,
    })
    syncSelectedTaskId(selectedIds)
  },

  isSelected: (id) => get().selectedIds.includes(id),
}))
