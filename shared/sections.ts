/** TickTick's default column / Open Tick default section name. */
export const DEFAULT_SECTION_NAME = 'Not Sectioned'

export function isDefaultSectionName(name: string): boolean {
  return name.trim().toLowerCase() === DEFAULT_SECTION_NAME.toLowerCase()
}
