import { createContext, useContext } from 'react'
import type { AppearanceSettings } from '@shared/appearance'

export interface AppearanceContextValue {
  appearance: AppearanceSettings
  ready: boolean
  updateAppearance: (partial: Partial<AppearanceSettings>) => Promise<AppearanceSettings>
  refresh: () => Promise<AppearanceSettings>
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) {
    throw new Error('useAppearance must be used within AppearanceProvider')
  }
  return ctx
}
