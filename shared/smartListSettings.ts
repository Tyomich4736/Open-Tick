import type { SmartListId } from './filters'

export const SMART_LIST_SETTINGS_KEY = 'smart_lists.config'

export const DEFAULT_SMART_LIST_ORDER: SmartListId[] = [
  'inbox',
  'today',
  'tomorrow',
  'week',
  'overdue',
  'completed',
]

export const SMART_LIST_LABELS: Record<SmartListId, string> = {
  inbox: 'Inbox',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 Days',
  overdue: 'Overdue',
  completed: 'Completed',
}

export interface SmartListConfigItem {
  id: SmartListId
  enabled: boolean
}

export type SmartListsConfig = SmartListConfigItem[]

export const DEFAULT_SMART_LISTS_CONFIG: SmartListsConfig = DEFAULT_SMART_LIST_ORDER.map(
  (id) => ({ id, enabled: true }),
)

const SMART_LIST_IDS = new Set<string>(DEFAULT_SMART_LIST_ORDER)

function isSmartListId(value: unknown): value is SmartListId {
  return typeof value === 'string' && SMART_LIST_IDS.has(value)
}

/** Merge stored config with defaults so new lists appear and unknowns are dropped. */
export function normalizeSmartListsConfig(value: unknown): SmartListsConfig {
  const byId = new Map<SmartListId, boolean>()

  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== 'object') continue
      const row = item as { id?: unknown; enabled?: unknown }
      if (!isSmartListId(row.id)) continue
      if (byId.has(row.id)) continue
      byId.set(row.id, row.enabled !== false)
    }
  }

  const ordered: SmartListsConfig = []
  for (const [id, enabled] of byId) {
    ordered.push({ id, enabled })
  }
  for (const id of DEFAULT_SMART_LIST_ORDER) {
    if (!byId.has(id)) ordered.push({ id, enabled: true })
  }
  return ordered
}

export function parseSmartListsConfig(value: unknown): SmartListsConfig | null {
  if (value == null) return null
  return normalizeSmartListsConfig(value)
}

export function enabledSmartListIds(config: SmartListsConfig): SmartListId[] {
  return config.filter((item) => item.enabled).map((item) => item.id)
}

export function moveSmartList(config: SmartListsConfig, from: number, to: number): SmartListsConfig {
  if (from === to || from < 0 || to < 0 || from >= config.length || to >= config.length) {
    return config
  }
  const next = [...config]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

export function setSmartListEnabled(
  config: SmartListsConfig,
  id: SmartListId,
  enabled: boolean,
): SmartListsConfig {
  return config.map((item) => (item.id === id ? { ...item, enabled } : item))
}

export function smartListPath(id: SmartListId): string {
  return `/${id}`
}
