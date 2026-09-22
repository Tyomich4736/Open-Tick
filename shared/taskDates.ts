import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

/**
 * Normalize any parseable instant to canonical UTC ISO (`…Z`) so SQLite
 * lexicographic compares on due_date/start_date are timezone-safe.
 *
 * TickTick often emits `+0000` / `+03:00` offsets; mixing those with
 * `formatISO` local offsets made all-day “tomorrow” tasks match Today.
 */
export function toUtcIso(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

/**
 * TickTick all-day due/start are midnight in the task timezone (often encoded
 * as the previous UTC evening, e.g. 2026-09-20T21:00:00.000+0000 = Sep 21 00:00
 * Europe/Minsk). Map to noon in that zone so calendar-day filters and UI chips
 * agree with the app’s local all-day convention.
 */
export function normalizeAllDayInstant(
  iso: string | null | undefined,
  timeZone: string | null | undefined,
): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null

  const zone =
    timeZone && timeZone.trim() && timeZone !== 'system' ? timeZone.trim() : 'UTC'

  try {
    const dateStr = formatInTimeZone(new Date(ms), zone, 'yyyy-MM-dd')
    return fromZonedTime(`${dateStr}T12:00:00.000`, zone).toISOString()
  } catch {
    return toUtcIso(iso)
  }
}

/** Bounds for smart-list / calendar overlap queries (always UTC Z). */
export function instantToFilterIso(date: Date): string {
  return date.toISOString()
}
