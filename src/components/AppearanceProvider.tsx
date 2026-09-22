import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { AppearanceSettings } from '@shared/appearance'
import { defaultAppearance } from '@shared/appearance'
import { AppearanceContext } from '@/hooks/appearanceContext'
import { applyAppearance } from '@/lib/appearance'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'

function isStickyBoot(): boolean {
  return (
    new URLSearchParams(window.location.search).get('window') === 'sticky' ||
    /^#\/sticky\//.test(window.location.hash)
  )
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const stickyBoot = isStickyBoot()
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => {
    const initial = defaultAppearance()
    applyAppearance(initial)
    return initial
  })
  // Sticky windows must not wait on IPC — a blank yellow shell was shown forever if invoke stalled.
  const [ready, setReady] = useState(stickyBoot)

  const refresh = useCallback(async () => {
    const next = unwrapIpc(await ipc.settings.getAppearance())
    setAppearance(next)
    applyAppearance(next)
    return next
  }, [])

  useEffect(() => {
    if (stickyBoot) {
      document.documentElement.style.backgroundColor = '#fff9c4'
      document.body.style.backgroundColor = '#fff9c4'
    }

    void refresh()
      .catch(() => {
        applyAppearance(defaultAppearance())
      })
      .finally(() => setReady(true))

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      void refresh()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [refresh, stickyBoot])

  const updateAppearance = useCallback(async (partial: Partial<AppearanceSettings>) => {
    const next = unwrapIpc(await ipc.settings.setAppearance(partial))
    setAppearance(next)
    applyAppearance(next)
    return next
  }, [])

  const value = useMemo(
    () => ({ appearance, ready, updateAppearance, refresh }),
    [appearance, ready, updateAppearance, refresh],
  )

  // Main window: wait until first appearance load. Sticky: always render children.
  if (!ready && !stickyBoot) return null

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}
