import { useEffect, useRef, useState } from 'react'
import type { TaskDetail, UpdateTaskInput } from '@shared/entities'
import type { ReminderInput } from '@shared/recurrence'

type DraftField =
  | 'title'
  | 'content'
  | 'priority'
  | 'due_date'
  | 'start_date'
  | 'is_all_day'
  | 'project_id'
  | 'tags'
  | 'recurrence_rule'
  | 'reminders'

export function useDebouncedTaskDraft(
  task: TaskDetail | undefined,
  onSave: (patch: UpdateTaskInput) => void,
) {
  const [draft, setDraftState] = useState<TaskDetail | null>(null)
  const [editScope, setEditScope] = useState<'this' | 'all'>('all')
  const dirtyRef = useRef<Set<DraftField>>(new Set())
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const setDraft = (next: TaskDetail | ((prev: TaskDetail | null) => TaskDetail | null)) => {
    setDraftState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      if (!resolved || !prev || resolved.id !== prev.id) {
        dirtyRef.current.clear()
        return resolved
      }
      const dirty = dirtyRef.current
      if (resolved.title !== prev.title) dirty.add('title')
      if ((resolved.content ?? '') !== (prev.content ?? '')) dirty.add('content')
      if (resolved.priority !== prev.priority) dirty.add('priority')
      if (resolved.due_date !== prev.due_date) dirty.add('due_date')
      if (resolved.start_date !== prev.start_date) dirty.add('start_date')
      if (resolved.is_all_day !== prev.is_all_day) dirty.add('is_all_day')
      if (resolved.project_id !== prev.project_id) dirty.add('project_id')
      if (JSON.stringify(resolved.tags) !== JSON.stringify(prev.tags)) dirty.add('tags')
      if (JSON.stringify(resolved.recurrence_rule) !== JSON.stringify(prev.recurrence_rule)) {
        dirty.add('recurrence_rule')
      }
      if (JSON.stringify(resolved.reminders) !== JSON.stringify(prev.reminders)) {
        dirty.add('reminders')
      }
      return resolved
    })
  }

  // Reset when switching tasks (intentionally keyed on id only)
  useEffect(() => {
    if (task) {
      setDraftState(task)
      dirtyRef.current.clear()
      setEditScope('all')
    } else {
      setDraftState(null)
      dirtyRef.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset when the selected task changes
  }, [task?.id])

  // Adopt server updates for fields the user hasn't edited (e.g. after bulk tag add)
  useEffect(() => {
    if (!task) return
    setDraftState((prev) => {
      if (!prev || prev.id !== task.id) return task
      const dirty = dirtyRef.current
      return {
        ...task,
        title: dirty.has('title') ? prev.title : task.title,
        content: dirty.has('content') ? prev.content : task.content,
        priority: dirty.has('priority') ? prev.priority : task.priority,
        due_date: dirty.has('due_date') ? prev.due_date : task.due_date,
        start_date: dirty.has('start_date') ? prev.start_date : task.start_date,
        is_all_day: dirty.has('is_all_day') ? prev.is_all_day : task.is_all_day,
        project_id: dirty.has('project_id') ? prev.project_id : task.project_id,
        tags: dirty.has('tags') ? prev.tags : task.tags,
        recurrence_rule: dirty.has('recurrence_rule') ? prev.recurrence_rule : task.recurrence_rule,
        reminders: dirty.has('reminders') ? prev.reminders : task.reminders,
      }
    })
  }, [task])

  useEffect(() => {
    if (!draft || !task || draft.id !== task.id) return

    const dirty = dirtyRef.current
    if (dirty.size === 0) return

    const reminderKey = (list: ReminderInput[]) =>
      JSON.stringify(list.map((r) => `${r.kind}:${r.offset_minutes}`))

    const patch: UpdateTaskInput = {}
    if (dirty.has('title') && draft.title !== task.title) patch.title = draft.title
    if (dirty.has('content') && (draft.content ?? '') !== (task.content ?? '')) {
      patch.content = draft.content
    }
    if (dirty.has('priority') && draft.priority !== task.priority) patch.priority = draft.priority
    if (dirty.has('due_date') && draft.due_date !== task.due_date) patch.due_date = draft.due_date
    if (dirty.has('start_date') && draft.start_date !== task.start_date) {
      patch.start_date = draft.start_date
    }
    if (dirty.has('is_all_day') && draft.is_all_day !== task.is_all_day) {
      patch.is_all_day = draft.is_all_day
    }
    if (dirty.has('project_id') && draft.project_id !== task.project_id) {
      patch.project_id = draft.project_id
    }
    if (dirty.has('tags') && JSON.stringify(draft.tags) !== JSON.stringify(task.tags)) {
      patch.tags = draft.tags
    }
    if (
      dirty.has('recurrence_rule') &&
      JSON.stringify(draft.recurrence_rule) !== JSON.stringify(task.recurrence_rule)
    ) {
      patch.recurrence_rule = draft.recurrence_rule
    }
    if (dirty.has('reminders') && reminderKey(draft.reminders) !== reminderKey(task.reminders)) {
      patch.reminders = draft.reminders.map((r) => ({
        kind: r.kind,
        offset_minutes: r.offset_minutes,
      }))
    }

    if (Object.keys(patch).length === 0) return

    const timer = setTimeout(() => {
      const isRecurring = Boolean(task.recurrence_rule) || Boolean(task.recurrence_parent_id)
      onSaveRef.current({
        ...patch,
        ...(isRecurring ? { recurrence_edit_scope: editScope } : {}),
      })
      // Keep dirty flags until server catches up via task effect above
    }, 500)

    return () => clearTimeout(timer)
  }, [draft, task, editScope])

  return { draft, setDraft, editScope, setEditScope }
}
