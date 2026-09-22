import { create } from 'zustand'
import { format } from 'date-fns'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

export type CalendarMode = 'month' | 'week' | 'days' | 'day' | 'agenda'

/** Visible day columns in “Days” mode. */
export type DaysCount = 2 | 3 | 4 | 5 | 6

export const DAYS_COUNT_OPTIONS: DaysCount[] = [2, 3, 4, 5, 6]

interface CalendarState {
  mode: CalendarMode
  /** Local calendar day as `yyyy-MM-dd` */
  cursorDate: string
  daysCount: DaysCount
  /** Task detail popup (calendar has no side panel). */
  popupTaskId: string | null
  setMode: (mode: CalendarMode) => void
  setCursorDate: (date: Date | string) => void
  setDaysCount: (count: DaysCount) => void
  openTaskPopup: (id: string) => void
  closeTaskPopup: () => void
  focusTitleToken: number
  requestFocusTitle: () => void
}

function toDateKey(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10)
  return format(date, 'yyyy-MM-dd')
}

export const useCalendarStore = create<CalendarState>((set) => ({
  mode: 'month',
  cursorDate: format(new Date(), 'yyyy-MM-dd'),
  daysCount: 3,
  popupTaskId: null,
  setMode: (mode) => set({ mode }),
  setCursorDate: (date) => set({ cursorDate: toDateKey(date) }),
  setDaysCount: (daysCount) => set({ daysCount }),
  openTaskPopup: (id) => {
    useTaskSelectionStore.getState().selectOne(id)
    set({ popupTaskId: id })
  },
  closeTaskPopup: () => {
    set({ popupTaskId: null })
    useTaskSelectionStore.getState().clear()
  },
  focusTitleToken: 0,
  requestFocusTitle: () =>
    set((s) => ({ focusTitleToken: s.focusTitleToken + 1 })),
}))
