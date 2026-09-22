import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Priority, TaskDetail, UpdateTaskInput } from '@shared/entities'
import type { ReminderInput } from '@shared/recurrence'
import { useTaskDetail, useTags, useSubtasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { TaskPanelEmpty } from '@/components/tasks/TaskPanelEmpty'
import { TaskRow } from '@/components/tasks/TaskRow'
import { MarkdownEditor } from '@/components/tasks/MarkdownEditor'
import { DateTimeReminderField } from '@/components/tasks/DateTimeReminderField'
import { RecurrenceField } from '@/components/tasks/RecurrenceField'
import { PriorityPicker } from '@/components/tasks/PriorityPicker'
import { TagChips } from '@/components/tasks/TagChips'
import { ProjectPickerChip } from '@/components/tasks/ProjectPickerChip'

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

function useDebouncedSave(
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

  // Reset when switching tasks
  useEffect(() => {
    if (task) {
      setDraftState(task)
      dirtyRef.current.clear()
      setEditScope('all')
    } else {
      setDraftState(null)
      dirtyRef.current.clear()
    }
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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function TaskDetailPanel({
  taskId: forcedTaskId,
  hideClose,
  onClose,
  variant = 'panel',
}: {
  taskId?: string
  hideClose?: boolean
  onClose?: () => void
  variant?: 'panel' | 'modal'
} = {}) {
  const selectedTaskId = useUiStore((s) => s.selectedTaskId)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const focusSubtaskAddToken = useUiStore((s) => s.focusSubtaskAddToken)
  const activeId = forcedTaskId ?? selectedTaskId
  const { data: task, isLoading } = useTaskDetail(activeId)
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const { data: subtasks = [] } = useSubtasks(activeId ?? '', Boolean(activeId))
  const { updateTask, toggleComplete, createTask } = useTaskMutations()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [fadeKey, setFadeKey] = useState(activeId)
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const focusTitleToken = useCalendarStore((s) => s.focusTitleToken)

  const { draft, setDraft, editScope, setEditScope } = useDebouncedSave(task, (patch) => {
    if (!activeId) return
    updateTask.mutate({ id: activeId, input: patch })
  })

  useEffect(() => {
    setFadeKey(activeId)
  }, [activeId])

  useEffect(() => {
    if (focusSubtaskAddToken > 0) {
      subtaskInputRef.current?.focus()
    }
  }, [focusSubtaskAddToken])

  useEffect(() => {
    if (focusTitleToken > 0) {
      const t = window.setTimeout(() => {
        titleInputRef.current?.focus()
        titleInputRef.current?.select()
      }, 50)
      return () => window.clearTimeout(t)
    }
  }, [focusTitleToken, activeId])

  const handleClose = () => {
    onClose?.()
    if (!onClose) clearSelection()
  }

  const shellClass =
    variant === 'modal'
      ? 'flex h-full min-h-0 w-full flex-col bg-bg-primary'
      : 'flex h-full w-full flex-col border-l border-border bg-bg-sidebar'

  if (!activeId) {
    return (
      <aside className={shellClass}>
        <TaskPanelEmpty />
      </aside>
    )
  }

  const isRecurring =
    Boolean(draft?.recurrence_rule) ||
    Boolean(draft?.recurrence_parent_id) ||
    Boolean(task?.recurrence_rule)

  const motionClass = prefersReducedMotion()
    ? ''
    : 'animate-[fadeIn_150ms_ease-out]'

  return (
    <aside className={shellClass}>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">Details</h3>
        {!hideClose && (
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1.5 text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            aria-label={variant === 'modal' ? 'Close' : 'Deselect task'}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div key={fadeKey} className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${motionClass}`}>
        {isLoading || !draft ? (
          <div className="p-4 text-sm text-text-muted">Loading…</div>
        ) : (
          <div className="space-y-5 p-5">
            <input
              ref={titleInputRef}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Task title"
              className="w-full bg-transparent text-lg font-medium text-text-primary outline-none placeholder:text-text-muted"
            />

            <div className="flex flex-wrap items-center gap-2">
              <DateTimeReminderField
                chip
                value={{
                  due_date: draft.due_date,
                  start_date: draft.start_date,
                  is_all_day: draft.is_all_day,
                  reminders: draft.reminders.map((r) => ({
                    kind: r.kind,
                    offset_minutes: r.offset_minutes,
                  })),
                }}
                onChange={(schedule) =>
                  setDraft({
                    ...draft,
                    due_date: schedule.due_date,
                    start_date: schedule.start_date,
                    is_all_day: schedule.is_all_day,
                    reminders: schedule.reminders.map((r, i) => ({
                      id: draft.reminders[i]?.id ?? `tmp-${i}`,
                      task_id: draft.id,
                      kind: r.kind,
                      offset_minutes: r.offset_minutes,
                      created_at: draft.reminders[i]?.created_at ?? '',
                    })),
                  })
                }
              />
              <RecurrenceField
                chip
                value={draft.recurrence_rule}
                onChange={(recurrence_rule) => setDraft({ ...draft, recurrence_rule })}
                editScope={editScope}
                onEditScopeChange={setEditScope}
                showEditScope={isRecurring}
              />
              <ProjectPickerChip
                projectId={draft.project_id}
                projects={projects}
                onChange={(project_id) => setDraft({ ...draft, project_id })}
              />
            </div>

            <MarkdownEditor
              value={draft.content}
              onChange={(content) => setDraft({ ...draft, content })}
            />

            <div className="flex items-start gap-2">
              <span className="mt-1 w-14 shrink-0 text-xs text-text-muted">Tags</span>
              <TagChips
                value={draft.tags}
                suggestions={tags.map((t) => t.name)}
                onChange={(nextTags) => setDraft({ ...draft, tags: nextTags })}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-text-muted">Priority</span>
              <PriorityPicker
                value={draft.priority}
                onChange={(priority) => setDraft({ ...draft, priority: priority as Priority })}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-text-muted">Subtasks</label>
              {subtasks.map((sub) => (
                <TaskRow
                  key={sub.id}
                  task={sub}
                  selected={false}
                  onSelect={() => {
                    if (variant === 'modal') {
                      useCalendarStore.getState().openTaskPopup(sub.id)
                    } else {
                      selectOne(sub.id)
                    }
                  }}
                  onToggleComplete={() =>
                    toggleComplete.mutate({ id: sub.id, completed: sub.status === 'completed' })
                  }
                />
              ))}
              <form
                className="mt-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!subtaskTitle.trim() || !activeId) return
                  createTask.mutate({
                    title: subtaskTitle.trim(),
                    project_id: draft.project_id,
                    parent_id: activeId,
                  })
                  setSubtaskTitle('')
                }}
              >
                <input
                  ref={subtaskInputRef}
                  value={subtaskTitle}
                  onChange={(e) => setSubtaskTitle(e.target.value)}
                  placeholder="Add subtask"
                  className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </form>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
