import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SMART_LISTS_CONFIG,
  defaultSmartListPath,
  enabledSmartListIds,
  moveSmartList,
  normalizeSmartListsConfig,
  setSmartListEnabled,
} from '../../shared/smartListSettings'

describe('normalizeSmartListsConfig', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeSmartListsConfig(null)).toEqual(DEFAULT_SMART_LISTS_CONFIG)
    expect(normalizeSmartListsConfig([])).toEqual(DEFAULT_SMART_LISTS_CONFIG)
  })

  it('keeps custom order and fills missing lists', () => {
    expect(
      normalizeSmartListsConfig([
        { id: 'today', enabled: false },
        { id: 'inbox', enabled: true },
      ]),
    ).toEqual([
      { id: 'today', enabled: false },
      { id: 'inbox', enabled: true },
      { id: 'tomorrow', enabled: true },
      { id: 'week', enabled: true },
      { id: 'overdue', enabled: true },
      { id: 'completed', enabled: true },
    ])
  })

  it('drops unknown ids', () => {
    const result = normalizeSmartListsConfig([{ id: 'nope', enabled: true }, { id: 'inbox' }])
    expect(result.map((r) => r.id)).toEqual([
      'inbox',
      'today',
      'tomorrow',
      'week',
      'overdue',
      'completed',
    ])
  })
})

describe('moveSmartList / setSmartListEnabled', () => {
  it('reorders items', () => {
    const next = moveSmartList(DEFAULT_SMART_LISTS_CONFIG, 0, 2)
    expect(next.map((i) => i.id)).toEqual([
      'today',
      'tomorrow',
      'inbox',
      'week',
      'overdue',
      'completed',
    ])
  })

  it('toggles enabled and lists visible ids', () => {
    const next = setSmartListEnabled(DEFAULT_SMART_LISTS_CONFIG, 'overdue', false)
    expect(enabledSmartListIds(next)).toEqual([
      'inbox',
      'today',
      'tomorrow',
      'week',
      'completed',
    ])
  })

  it('picks the first enabled list as the default home path', () => {
    expect(defaultSmartListPath(DEFAULT_SMART_LISTS_CONFIG)).toBe('/inbox')
    const todayFirst = moveSmartList(
      setSmartListEnabled(DEFAULT_SMART_LISTS_CONFIG, 'inbox', false),
      1,
      0,
    )
    expect(defaultSmartListPath(todayFirst)).toBe('/today')
  })
})
