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
      columnId: 'col-abc',
      tags: ['errands'],
      reminders: ['TRIGGER:-PT30M'],
      repeatFlag: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=FR',
    })
    expect(task.title).toBe('Buy milk')
    expect(task.priority).toBe(5)
    expect(task.status).toBe('pending')
    expect(task.column_remote_id).toBe('col-abc')
    expect(task.tags).toEqual(['errands'])
    expect(task.start_date).toBe('2026-09-03T06:00:00.000Z')
    expect(task.due_date).toBe('2026-09-03T07:00:00.000Z')
    expect(task.reminders[0]).toEqual({ kind: 'before', offset_minutes: 30 })
    expect(task.recurrence_rule?.frequency).toBe('weekly')
  })

  it('treats completedTime as completed even when status is omitted', () => {
    const task = remoteTaskToLocal({
      id: 't-done',
      projectId: 'p1',
      title: 'Finished',
      completedTime: '2026-10-30T10:00:00.000+0000',
    })
    expect(task.status).toBe('completed')
    expect(task.completed_at).toBe('2026-10-30T10:00:00.000+0000')
  })

  it('keeps recurring masters pending when status is 0 despite stale completedTime', () => {
    const task = remoteTaskToLocal({
      id: 't-repeat',
      projectId: 'p1',
      title: 'CGM Refinement',
      status: 0,
      dueDate: '2026-11-12T12:00:00+01:00',
      completedTime: '2026-06-11T08:00:03.000+0000',
      repeatFlag: 'RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=TH',
    })
    expect(task.status).toBe('pending')
    expect(task.completed_at).toBeNull()
    expect(task.recurrence_rule?.frequency).toBe('weekly')
  })

  it('treats status 1 as completed', () => {
    const task = remoteTaskToLocal({
      id: 't-status-1',
      projectId: 'p1',
      title: 'Done via status 1',
      status: 1,
      completedTime: '2026-10-30T10:00:00.000+0000',
    })
    expect(task.status).toBe('completed')
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

  it('maps TickTick same-day isAllDay start===due as date-only (No time)', () => {
    // 2026-09-20T21:00:00Z = 2026-09-21 00:00 Europe/Minsk → date-only Sep 21
    const task = remoteTaskToLocal({
      id: 't3',
      projectId: 'p1',
      title: 'Due tomorrow',
      dueDate: '2026-09-20T21:00:00.000+0000',
      startDate: '2026-09-20T21:00:00.000+0000',
      isAllDay: true,
      timeZone: 'Europe/Minsk',
    })
    expect(task.is_all_day).toBe(false)
    expect(task.start_date).toBeNull()
    // Midnight Minsk on Sep 21 = 21:00 UTC Sep 20 (no clock / not noon)
    expect(task.due_date).toBe('2026-09-20T21:00:00.000Z')
  })

  it('maps all-day with only dueDate as date-only (No time)', () => {
    const task = remoteTaskToLocal({
      id: 't3b',
      projectId: 'p1',
      title: 'Due someday',
      dueDate: '2026-09-20T21:00:00.000+0000',
      isAllDay: true,
      timeZone: 'Europe/Minsk',
    })
    expect(task.is_all_day).toBe(false)
    expect(task.start_date).toBeNull()
    expect(task.due_date).toBe('2026-09-20T21:00:00.000Z')
  })

  it('keeps multi-day TickTick all-day as an all-day event', () => {
    const task = remoteTaskToLocal({
      id: 't3c',
      projectId: 'p1',
      title: 'Trip',
      dueDate: '2026-09-22T21:00:00.000+0000',
      startDate: '2026-09-20T21:00:00.000+0000',
      isAllDay: true,
      timeZone: 'Europe/Minsk',
    })
    expect(task.is_all_day).toBe(true)
    expect(task.start_date).toBe('2026-09-21T09:00:00.000Z')
    expect(task.due_date).toBe('2026-09-23T09:00:00.000Z')
  })

  it('pushes date-only as isAllDay without start; all-day events with start', () => {
    const dateOnly = localTaskToRemote({
      title: 'No time',
      content: '',
      projectRemoteId: 'p1',
      priority: 0,
      status: 'pending',
      due_date: '2026-09-20T21:00:00.000Z',
      start_date: null,
      is_all_day: false,
      time_zone: 'Europe/Minsk',
      tags: [],
      reminders: [],
      recurrence_rule: null,
      sort_order: 1,
    })
    // TickTick needs isAllDay to hide the clock; midnight due ⇒ date-only, not a span event
    expect(dateOnly.isAllDay).toBe(true)
    expect(dateOnly.startDate).toBeNull()
    expect(dateOnly.dueDate).toBe('2026-09-20T21:00:00.000Z')

    const allDay = localTaskToRemote({
      title: 'All day',
      content: '',
      projectRemoteId: 'p1',
      priority: 0,
      status: 'pending',
      due_date: '2026-09-21T09:00:00.000Z',
      start_date: '2026-09-21T09:00:00.000Z',
      is_all_day: true,
      time_zone: 'Europe/Minsk',
      tags: [],
      reminders: [],
      recurrence_rule: null,
      sort_order: 1,
    })
    expect(allDay.isAllDay).toBe(true)
    expect(allDay.startDate).toBe('2026-09-21T09:00:00.000Z')
  })

  it('pushes timed due-only (no start) without isAllDay so TickTick keeps the clock', () => {
    // 10:00 Europe/Moscow
    const timed = localTaskToRemote({
      title: 'Meeting',
      content: '',
      projectRemoteId: 'p1',
      priority: 0,
      status: 'pending',
      due_date: '2026-09-03T07:00:00.000Z',
      start_date: null,
      is_all_day: false,
      time_zone: 'Europe/Moscow',
      tags: [],
      reminders: [{ kind: 'before', offset_minutes: 15 }],
      recurrence_rule: null,
      sort_order: 1,
    })
    expect(timed.isAllDay).toBe(false)
    expect(timed.startDate).toBeNull()
    expect(timed.dueDate).toBe('2026-09-03T07:00:00.000Z')
    expect(timed.reminders).toEqual(['TRIGGER:-PT15M'])
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
      isAllDay: false,
      dueDate: '2026-09-03T07:00:00.000Z',
      tags: ['errands'],
      reminders: ['TRIGGER:-PT30M'],
    })
    expect(extractRemoteId({ id: 'abc' })).toBe('abc')
    expect(extractRemoteId({})).toBeNull()
  })
})
