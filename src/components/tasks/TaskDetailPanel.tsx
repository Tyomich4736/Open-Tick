import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Priority } from '@shared/entities'
import { useTaskDetail, useTags, useSubtasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useDebouncedTaskDraft } from '@/hooks/useDebouncedTaskDraft'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { useListDensity } from '@/hooks/useLayoutSettings'
import { useUiStore } from '@/stores/uiStore'
import {
  selectSelectedTaskId,
  useTaskSelectionStore,
} from '@/stores/taskSelectionStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { TaskPanelEmpty } from '@/components/tasks/TaskPanelEmpty'
import { TaskRow } from '@/components/tasks/TaskRow'
import { MarkdownEditor } from '@/components/tasks/MarkdownEditor'
import { DateTimeReminderField } from '@/components/tasks/DateTimeReminderField'
import { RecurrenceField } from '@/components/tasks/RecurrenceField'
import { PriorityPicker } from '@/components/tasks/PriorityPicker'
import { TagChips } from '@/components/tasks/TagChips'
import { ProjectPickerChip } from '@/components/tasks/ProjectPickerChip'

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
  const selectedTaskId = useTaskSelectionStore(selectSelectedTaskId)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const focusSubtaskAddToken = useUiStore((s) => s.focusSubtaskAddToken)
  const activeId = forcedTaskId ?? selectedTaskId
  const { data: task, isLoading } = useTaskDetail(activeId)
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const { data: subtasks = [] } = useSubtasks(activeId ?? '', Boolean(activeId))
  const { updateTask, toggleComplete, createTask } = useTaskMutations()
  const { timeFormat } = useTimeFormat()
  const { density } = useListDensity()
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [fadeKey, setFadeKey] = useState(activeId)
  const subtaskInputRef = useRef<HTMLInputElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const focusTitleToken = useCalendarStore((s) => s.focusTitleToken)

  const { draft, setDraft, editScope, setEditScope } = useDebouncedTaskDraft(task, (patch) => {
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
            <div className="flex items-start gap-3">
              {variant === 'modal' && (
                <input
                  type="checkbox"
                  checked={draft.status === 'completed'}
                  onChange={() =>
                    toggleComplete.mutate({
                      id: draft.id,
                      completed: draft.status === 'completed',
                    })
                  }
                  aria-label={`Mark complete: ${draft.title || 'task'}`}
                  className="task-checkbox mt-1.5 size-5 shrink-0 cursor-pointer transition-transform duration-150 checked:scale-110"
                />
              )}
              <input
                ref={titleInputRef}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Task title"
                className={[
                  'min-w-0 flex-1 bg-transparent text-lg font-medium outline-none placeholder:text-text-muted',
                  draft.status === 'completed'
                    ? 'text-text-muted line-through'
                    : 'text-text-primary',
                ].join(' ')}
              />
            </div>

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
                  timeFormat={timeFormat}
                  density={density}
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
