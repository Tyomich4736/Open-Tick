/** TickTick's default column / Open Tick default section name. */
export const DEFAULT_SECTION_NAME = 'Not Sectioned'

/** Names that mean the same undeletable default bucket (legacy UI / TickTick variants). */
const DEFAULT_SECTION_ALIASES = new Set([
  'not sectioned',
  'no section',
  'no sectioned',
  'unsectioned',
])

export function isDefaultSectionName(name: string): boolean {
  return DEFAULT_SECTION_ALIASES.has(name.trim().toLowerCase())
}
