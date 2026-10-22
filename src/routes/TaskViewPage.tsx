import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { addDays, formatISO, startOfDay } from 'date-fns'
import type { ViewType } from '@/lib/viewContext'
import { emptyStateForView, filterFromView, viewFromPath, viewSortScope } from '@/lib/viewContext'
import { useProjects, useInboxProject } from '@/hooks/useProjects'
import { useListPreferences } from '@/hooks/useListPreferences'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useUiStore } from '@/stores/uiStore'
import {
  selectSelectedTaskId,
  useTaskSelectionStore,
} from '@/stores/taskSelectionStore'
import { ipc } from '@/lib/ipc-client'
import { groupByOptionsForView } from '@shared/filters'
import { QuickAdd } from '@/components/tasks/QuickAdd'
import { TaskList } from '@/components/tasks/TaskList'
import { ViewSettingsButton } from '@/components/tasks/ViewSettingsButton'
import { ViewModeSwitcher } from '@/components/calendar/ViewModeSwitcher'

interface TaskViewPageProps {
  view: ViewType
}

function defaultDueDate(view: ViewType): string | null {
  if (view.kind !== 'smart') return null
  const now = new Date()
  switch (view.smart_list) {
    case 'today':
      return formatISO(startOfDay(now))
    case 'tomorrow':
      return formatISO(startOfDay(addDays(now, 1)))
    default:
      return null
  }
}

export function TaskViewPage({ view }: TaskViewPageProps) {
  const location = useLocation()
  const scope = viewSortScope(view)
  const smartList = view.kind === 'smart' ? view.smart_list : null
  const { sort, showCompleted, groupBy, setSort, setShowCompleted, setGroupBy } =
    useListPreferences(scope, smartList, { allowListGroup: view.kind === 'smart' })

  const filter = useMemo(
    () =>
      filterFromView(view, {
        sort,
        includeCompleted: showCompleted,
      }),
    [view, sort, showCompleted],
  )

  const { data: projects } = useProjects()
  const inbox = useInboxProject(projects)
  const { createTask, deleteTask, bulkDelete } = useTaskMutations()
  const focusQuickAdd = useUiStore((s) => s.focusQuickAdd)
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const selectedTaskId = useTaskSelectionStore(selectSelectedTaskId)
  const clearSelection = useTaskSelectionStore((s) => s.clear)

  const defaultProjectId = view.kind === 'project' ? view.projectId : inbox?.id

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') clearSelection()
        return
      }
      // TipTap / contenteditable
      if ((e.target as HTMLElement)?.isContentEditable) return

      if (e.key === 'Escape') clearSelection()
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        focusQuickAdd()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        focusQuickAdd()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        if (selectedTaskId) {
          e.preventDefault()
          void ipc.tasks.openWindow(selectedTaskId)
        }
      }
      if (e.key === 'Delete') {
        if (selectedIds.length >= 2) {
          e.preventDefault()
          if (window.confirm(`Delete ${selectedIds.length} tasks?`)) {
            bulkDelete.mutate(selectedIds)
          }
          return
        }
        if (selectedTaskId) {
          e.preventDefault()
          if (window.confirm('Delete this task?')) {
            deleteTask.mutate(selectedTaskId)
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    clearSelection,
    focusQuickAdd,
    selectedTaskId,
    selectedIds,
    deleteTask,
    bulkDelete,
  ])

  const isCompletedView = view.kind === 'smart' && view.smart_list === 'completed'
  const isOverdueView = view.kind === 'smart' && view.smart_list === 'overdue'
  const canQuickAdd = !isCompletedView && !isOverdueView
  const canShowCompletedToggle =
    view.kind === 'project' ||
    view.kind === 'tag' ||
    smartList === 'inbox' ||
    smartList === 'today' ||
    smartList === 'tomorrow' ||
    smartList === 'week'

  const empty = emptyStateForView(view)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold text-text-primary">{view.title}</h2>
            {selectedIds.length > 1 && (
              <span className="text-sm text-text-muted">{selectedIds.length} selected</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-text-muted">{view.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {!isCompletedView && (
            <ViewSettingsButton
              sort={sort}
              onSortChange={setSort}
              showSort
              showCompleted={showCompleted}
              onShowCompletedChange={setShowCompleted}
              showCompletedToggle={canShowCompletedToggle}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              groupByOptions={groupByOptionsForView(view.kind)}
            />
          )}
          <ViewModeSwitcher listPath={location.pathname} />
        </div>
      </header>

      {canQuickAdd && (
        <QuickAdd
          placeholder={`Add task to ${view.title}`}
          disabled={!defaultProjectId}
          onSubmit={(title) => {
            if (!defaultProjectId) return
            createTask.mutate({
              title,
              project_id: defaultProjectId,
              due_date: defaultDueDate(view),
              is_all_day: true,
              tags: view.kind === 'tag' ? [view.tagName] : undefined,
            })
          }}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        <TaskList
          filter={filter}
          allowReorder={!isCompletedView && sort === 'order' && groupBy === 'none'}
          emptyTitle={empty.title}
          emptyDescription={empty.description}
          groupBy={isCompletedView ? 'none' : groupBy}
        />
      </div>
    </div>
  )
}

export function TaskViewPageFromRoute() {
  const location = useLocation()
  const { data: projects } = useProjects()
  const projectId = location.pathname.match(/\/project\/(.+)$/)?.[1]
  const projectName = projects?.find((p) => p.id === projectId)?.name

  const view = useMemo(
    () => viewFromPath(location.pathname, projectName),
    [location.pathname, projectName],
  )

  if (!view) {
    return <div className="p-6 text-text-muted">Unknown view</div>
  }

  return <TaskViewPage view={view} />
}
