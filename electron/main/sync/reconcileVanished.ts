/**
 * After a successful `/project/.../data` pull, local pending tasks with a remote id
 * that are missing from that snapshot were completed or deleted on TickTick.
 */

export type VanishAction = 'force_complete' | 'remove' | 'noop'

export function classifyVanishedTask(input: {
  localStatus: 'pending' | 'completed'
  inCompletedPull: boolean
}): VanishAction {
  if (input.inCompletedPull) {
    return input.localStatus === 'pending' ? 'force_complete' : 'noop'
  }
  // Not in /data and not in the completed window → deleted (or completed long ago).
  return 'remove'
}

/** Completed lookback: since last successful pull (with overlap), capped at maxLookbackDays. */
export function completedPullSince(
  lastFullSyncAt: string | null | undefined,
  now = new Date(),
  options?: { overlapMs?: number; maxLookbackDays?: number },
): Date {
  const overlapMs = options?.overlapMs ?? 24 * 60 * 60 * 1000
  const maxLookbackDays = options?.maxLookbackDays ?? 90
  const maxLookbackMs = maxLookbackDays * 24 * 60 * 60 * 1000
  const floor = now.getTime() - maxLookbackMs
  if (!lastFullSyncAt) return new Date(floor)
  const last = Date.parse(lastFullSyncAt)
  if (Number.isNaN(last)) return new Date(floor)
  return new Date(Math.max(floor, last - overlapMs))
}

/** How many completed-list windows to cover `since`→now without exceeding the API ~200/window cap. */
export function completedPullWindowPlan(
  since: Date,
  now = new Date(),
  options?: { windowDays?: number; maxWindows?: number },
): { windowDays: number; maxWindows: number } {
  const windowDays = options?.windowDays ?? 14
  const maxWindowsCap = options?.maxWindows ?? 12
  const spanMs = Math.max(0, now.getTime() - since.getTime())
  const spanDays = spanMs / (24 * 60 * 60 * 1000)
  const needed = Math.max(1, Math.ceil(spanDays / windowDays) + 1)
  return { windowDays, maxWindows: Math.min(needed, maxWindowsCap) }
}
