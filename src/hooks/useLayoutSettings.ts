import { useCallback, useEffect, useState } from 'react'
import { ipc } from '@/lib/ipc-client'

export const LAYOUT_DEFAULTS = {
  sidebarWidth: 240 as number,
  detailWidth: 400 as number,
  sidebarCollapsed: false as boolean,
}

export const LAYOUT_LIMITS = {
  sidebarMin: 180,
  sidebarMax: 480,
  sidebarCollapsedWidth: 64,
  detailMin: 280,
  detailMax: 560,
  listMin: 280,
} as const

const KEYS = {
  sidebarWidth: 'layout.sidebar_width',
  detailWidth: 'layout.detail_width',
  sidebarCollapsed: 'layout.sidebar_collapsed',
  listDensity: 'list_density',
} as const

export type ListDensity = 'comfortable' | 'compact'

async function readSetting<T>(key: string): Promise<T | null> {
  const result = await ipc.settings.get<T>(key)
  if (!result.ok) return null
  return (result.data as T | null) ?? null
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const result = await ipc.settings.set(key, value)
  if (!result.ok) {
    console.error('Failed to save setting', key, result.error)
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function useLayoutSettings() {
  const [sidebarWidth, setSidebarWidthState] = useState(LAYOUT_DEFAULTS.sidebarWidth)
  const [detailWidth, setDetailWidthState] = useState(LAYOUT_DEFAULTS.detailWidth)
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(LAYOUT_DEFAULTS.sidebarCollapsed)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [sw, dw, collapsed] = await Promise.all([
        readSetting<number>(KEYS.sidebarWidth),
        readSetting<number>(KEYS.detailWidth),
        readSetting<boolean>(KEYS.sidebarCollapsed),
      ])
      if (cancelled) return
      if (typeof sw === 'number') {
        setSidebarWidthState(clamp(sw, LAYOUT_LIMITS.sidebarMin, LAYOUT_LIMITS.sidebarMax))
      }
      if (typeof dw === 'number') {
        setDetailWidthState(clamp(dw, LAYOUT_LIMITS.detailMin, LAYOUT_LIMITS.detailMax))
      }
      if (typeof collapsed === 'boolean') setSidebarCollapsedState(collapsed)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setSidebarWidth = useCallback((next: number) => {
    const value = clamp(next, LAYOUT_LIMITS.sidebarMin, LAYOUT_LIMITS.sidebarMax)
    setSidebarWidthState(value)
    void writeSetting(KEYS.sidebarWidth, value)
  }, [])

  const setDetailWidth = useCallback((next: number) => {
    const value = clamp(next, LAYOUT_LIMITS.detailMin, LAYOUT_LIMITS.detailMax)
    setDetailWidthState(value)
    void writeSetting(KEYS.detailWidth, value)
  }, [])

  const setSidebarCollapsed = useCallback((next: boolean) => {
    setSidebarCollapsedState(next)
    void writeSetting(KEYS.sidebarCollapsed, next)
  }, [])

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(LAYOUT_DEFAULTS.sidebarWidth)
  }, [setSidebarWidth])

  const resetDetailWidth = useCallback(() => {
    setDetailWidth(LAYOUT_DEFAULTS.detailWidth)
  }, [setDetailWidth])

  const effectiveSidebarWidth = sidebarCollapsed
    ? LAYOUT_LIMITS.sidebarCollapsedWidth
    : sidebarWidth

  return {
    ready,
    sidebarWidth,
    detailWidth,
    sidebarCollapsed,
    effectiveSidebarWidth,
    setSidebarWidth,
    setDetailWidth,
    setSidebarCollapsed,
    resetSidebarWidth,
    resetDetailWidth,
  }
}

export function useListDensity() {
  const [density, setDensityState] = useState<ListDensity>('comfortable')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await readSetting<ListDensity>(KEYS.listDensity)
      if (cancelled) return
      if (stored === 'comfortable' || stored === 'compact') setDensityState(stored)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setDensity = useCallback((next: ListDensity) => {
    setDensityState(next)
    void writeSetting(KEYS.listDensity, next)
  }, [])

  return { density, setDensity }
}
