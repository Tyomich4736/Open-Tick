/** Stored value meaning “follow the OS timezone”. */
export const SYSTEM_TIMEZONE = 'system'

export function detectSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Resolve a stored setting (`system` / missing) to an IANA zone. */
export function resolveTimezone(stored: string | null | undefined): string {
  if (!stored || stored === SYSTEM_TIMEZONE) return detectSystemTimezone()
  return stored
}
