import { describe, expect, it } from 'vitest'
import {
  coerceRemoteTaskArray,
  toTickTickDateParam,
} from '../../../electron/main/ticktick/TickTickClient'

describe('completed pull helpers', () => {
  it('formats dates for /task/completed', () => {
    expect(toTickTickDateParam(new Date('2026-03-01T00:58:20.123Z'))).toBe(
      '2026-03-01T00:58:20.000+0000',
    )
  })

  it('coerces wrapped completed payloads', () => {
    expect(coerceRemoteTaskArray([{ id: 'a', projectId: 'p' }])).toHaveLength(1)
    expect(coerceRemoteTaskArray({ tasks: [{ id: 'b', projectId: 'p' }] })).toHaveLength(1)
    expect(coerceRemoteTaskArray({ data: [{ id: 'c', projectId: 'p' }] })).toHaveLength(1)
    expect(coerceRemoteTaskArray(null)).toEqual([])
  })
})
