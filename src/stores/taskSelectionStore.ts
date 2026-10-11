import { create } from 'zustand'

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

/** Single selected task id, or null when zero/many are selected. */
export function selectSelectedTaskId(state: TaskSelectionState): string | null {
  return state.selectedIds.length === 1 ? state.selectedIds[0]! : null
}

export const useTaskSelectionStore = create<TaskSelectionState>((set, get) => ({
  selectedIds: [],
  anchorId: null,
  pendingSelectId: null,

  selectOne: (id) => {
    set({ selectedIds: [id], anchorId: id, pendingSelectId: null })
  },

  openTask: (id) => {
    set({ selectedIds: [id], anchorId: id, pendingSelectId: id })
  },

  toggle: (id) => {
    const prev = get().selectedIds
    const has = prev.includes(id)
    const selectedIds = has ? prev.filter((x) => x !== id) : [...prev, id]
    const anchorId = has
      ? selectedIds[selectedIds.length - 1] ?? null
      : id
    set({ selectedIds, anchorId, pendingSelectId: null })
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
  },

  clear: () => {
    set({ selectedIds: [], anchorId: null, pendingSelectId: null })
  },

  onListFilterChange: () => {
    const pending = get().pendingSelectId
    if (pending) {
      set({ selectedIds: [pending], anchorId: pending })
      return
    }
    set({ selectedIds: [], anchorId: null })
  },

  setMany: (ids) => {
    const selectedIds = [...new Set(ids)]
    set({
      selectedIds,
      anchorId: selectedIds[selectedIds.length - 1] ?? null,
      pendingSelectId: null,
    })
  },

  isSelected: (id) => get().selectedIds.includes(id),
}))
