import { describe, expect, it } from 'vitest'
import {
  classifyVanishedTask,
  completedPullSince,
  completedPullWindowPlan,
} from '../../../electron/main/sync/reconcileVanished'

describe('reconcileVanished', () => {
  it('force-completes pending locals found in the completed pull', () => {
    expect(
      classifyVanishedTask({ localStatus: 'pending', inCompletedPull: true }),
    ).toBe('force_complete')
    expect(
      classifyVanishedTask({ localStatus: 'completed', inCompletedPull: true }),
    ).toBe('noop')
  })

  it('removes locals missing from /data and not in the completed pull', () => {
    expect(
      classifyVanishedTask({ localStatus: 'pending', inCompletedPull: false }),
    ).toBe('remove')
  })

  it('completedPullSince uses last sync with overlap and caps lookback', () => {
    const now = new Date('2026-10-31T12:00:00.000Z')
    expect(completedPullSince(null, now).toISOString()).toBe('2026-08-02T12:00:00.000Z')

    const recent = completedPullSince('2026-10-30T12:00:00.000Z', now)
    expect(recent.toISOString()).toBe('2026-10-29T12:00:00.000Z')
  })

  it('completedPullWindowPlan covers the since span with 14-day windows', () => {
    const now = new Date('2026-10-31T12:00:00.000Z')
    const since = new Date('2026-10-29T12:00:00.000Z')
    expect(completedPullWindowPlan(since, now)).toEqual({ windowDays: 14, maxWindows: 2 })

    const long = completedPullWindowPlan(new Date('2026-08-02T12:00:00.000Z'), now)
    expect(long.windowDays).toBe(14)
    expect(long.maxWindows).toBeGreaterThan(2)
    expect(long.maxWindows).toBeLessThanOrEqual(12)
  })
})
