import { describe, expect, it } from 'vitest'
import {
  extractRemoteId,
  localTaskToRemote,
  mapRemoteRecurrence,
  mapRemoteReminders,
  normalizeRemoteSchedule,
  parseIsoDurationToMinutes,
  recurrenceToRepeatFlag,
  reminderToTrigger,
  remoteProjectToLocal,
  remoteTaskToLocal,
} from '../../../electron/main/sync/mappers'

describe('sync mappers', () => {
  it('parses ISO durations to minutes', () => {
    expect(parseIsoDurationToMinutes('PT15M')).toBe(15)
    expect(parseIsoDurationToMinutes('PT1H')).toBe(60)
    expect(parseIsoDurationToMinutes('P1D')).toBe(1440)
    expect(parseIsoDurationToMinutes('PT0S')).toBe(0)
  })

  it('maps reminder triggers', () => {
    expect(mapRemoteReminders(['TRIGGER:PT0S', 'TRIGGER:-PT15M', 'TRIGGER:-P1D'])).toEqual([
      { kind: 'at_due', offset_minutes: 0 },
      { kind: 'before', offset_minutes: 15 },
      { kind: 'before', offset_minutes: 1440 },
    ])
  })

  it('maps RRULE recurrence', () => {
    const daily = mapRemoteRecurrence('RRULE:FREQ=DAILY;INTERVAL=2')
    expect(daily).toMatchObject({ frequency: 'daily', interval: 2, anchor: 'due_date' })

    const weekly = mapRemoteRecurrence('FREQ=WEEKLY;BYDAY=MO,WE')
    expect(weekly?.frequency).toBe('weekly')
    expect(weekly?.weekdays).toEqual([1, 3])
  })

  it('maps remote project and task', () => {
    const project = remoteProjectToLocal({
      id: 'p1',
      name: 'Work',
      color: '#ff0000',
      groupId: 'g1',
      viewMode: 'kanban',
      sortOrder: 3,
    })
    expect(project).toMatchObject({
      remote_id: 'p1',
      name: 'Work',
      color: '#ff0000',
      group_remote_id: 'g1',
      view_mode: 'kanban',
      sort_order: 3,
    })

    const task = remoteTaskToLocal({
      id: 't1',
      projectId: 'p1',
      title: 'Buy milk',
      content: '2%',
      priority: 5,
      status: 0,
      dueDate: '2026-09-03T10:00:00+03:00',
      startDate: '2026-09-03T09:00:00+03:00',
      isAllDay: false,
      tags: ['errands'],
      reminders: ['TRIGGER:-PT30M'],
      repeatFlag: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR',
    })
    expect(task.title).toBe('Buy milk')
    expect(task.priority).toBe(5)
    expect(task.status).toBe('pending')
    expect(task.tags).toEqual(['errands'])
    expect(task.start_date).toBe('2026-09-03T06:00:00.000Z')
    expect(task.due_date).toBe('2026-09-03T07:00:00.000Z')
    expect(task.reminders[0]).toEqual({ kind: 'before', offset_minutes: 30 })
    expect(task.recurrence_rule?.frequency).toBe('weekly')
  })

  it('collapses TickTick point-in-time start===due to due-only (UTC Z)', () => {
    expect(
      normalizeRemoteSchedule('2026-09-03T15:00:00+03:00', '2026-09-03T15:00:00+03:00'),
    ).toEqual({
      due_date: '2026-09-03T12:00:00.000Z',
      start_date: null,
    })
    expect(normalizeRemoteSchedule(null, '2026-09-03T15:00:00+03:00')).toEqual({
      due_date: '2026-09-03T12:00:00.000Z',
      start_date: null,
    })

    const task = remoteTaskToLocal({
      id: 't2',
      projectId: 'p1',
      title: 'Call',
      dueDate: '2026-09-03T15:00:00+03:00',
      startDate: '2026-09-03T15:00:00+03:00',
    })
    expect(task.start_date).toBeNull()
    expect(task.due_date).toBe('2026-09-03T12:00:00.000Z')
  })

  it('maps TickTick all-day midnight-in-TZ to noon on that calendar day', () => {
    // 2026-09-20T21:00:00Z = 2026-09-21 00:00 Europe/Minsk → all-day Sep 21
    const task = remoteTaskToLocal({
      id: 't3',
      projectId: 'p1',
      title: 'All day tomorrow',
      dueDate: '2026-09-20T21:00:00.000+0000',
      startDate: '2026-09-20T21:00:00.000+0000',
      isAllDay: true,
      timeZone: 'Europe/Minsk',
    })
    expect(task.is_all_day).toBe(true)
    expect(task.start_date).toBeNull()
    // Noon Minsk on Sep 21 = 09:00 UTC
    expect(task.due_date).toBe('2026-09-21T09:00:00.000Z')
  })

  it('keeps timed duration start/due as UTC Z without collapsing', () => {
    const task = remoteTaskToLocal({
      id: 't4',
      projectId: 'p1',
      title: 'Meeting',
      dueDate: '2026-09-03T10:00:00+03:00',
      startDate: '2026-09-03T09:00:00+03:00',
      isAllDay: false,
    })
    expect(task.start_date).toBe('2026-09-03T06:00:00.000Z')
    expect(task.due_date).toBe('2026-09-03T07:00:00.000Z')
  })

  it('maps local reminders and recurrence outbound', () => {
    expect(reminderToTrigger({ kind: 'at_due', offset_minutes: 0 })).toBe('TRIGGER:PT0S')
    expect(reminderToTrigger({ kind: 'before', offset_minutes: 15 })).toBe('TRIGGER:-PT15M')
    expect(reminderToTrigger({ kind: 'before', offset_minutes: 1440 })).toBe('TRIGGER:-P1D')
    expect(
      recurrenceToRepeatFlag({
        frequency: 'weekly',
        interval: 1,
        weekdays: [1, 5],
        anchor: 'due_date',
        end: { type: 'never' },
      }),
    ).toBe('RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR')
  })

  it('maps local task to remote DTO', () => {
    const dto = localTaskToRemote({
      title: 'Buy milk',
      content: '2%',
      projectRemoteId: 'p1',
      priority: 5,
      status: 'pending',
      due_date: '2026-09-03T07:00:00.000Z',
      start_date: null,
      is_all_day: false,
      time_zone: 'Europe/Moscow',
      tags: ['errands'],
      reminders: [{ kind: 'before', offset_minutes: 30 }],
      recurrence_rule: null,
      sort_order: 1,
    })
    expect(dto).toMatchObject({
      title: 'Buy milk',
      projectId: 'p1',
      priority: 5,
      status: 0,
      tags: ['errands'],
      reminders: ['TRIGGER:-PT30M'],
    })
    expect(extractRemoteId({ id: 'abc' })).toBe('abc')
    expect(extractRemoteId({})).toBeNull()
  })
})
