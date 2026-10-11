import { addDays, formatISO, startOfDay } from 'date-fns'
import type { Priority } from '@shared/entities'
import { useProjects } from '@/hooks/useProjects'
import { useTags } from '@/hooks/useTasks'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { useSelectedTaskStatuses } from '@/components/tasks/TaskPanelMultiSelect'
import { TaskActionMenuShell } from '@/components/tasks/taskMenu/TaskActionMenuShell'
import { SharedMenuSections } from '@/components/tasks/taskMenu/sharedSections'
import { Divider, MenuItem } from '@/components/tasks/taskMenu/menuPrimitives'

export function BulkTaskContextMenu() {
  const menu = useUiStore((s) => s.contextMenu)
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const { bulkUpdate, bulkComplete, bulkDelete } = useTaskMutations()
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const statuses = useSelectedTaskStatuses(selectedIds)

  const active =
    menu?.type === 'task' &&
    selectedIds.length >= 2 &&
    selectedIds.includes(menu.id)

  const ids = selectedIds
  const n = ids.length
  const known = ids.filter((id) => statuses.has(id))
  const allCompleted =
    known.length > 0 && known.every((id) => statuses.get(id) === 'completed')
  const allPending =
    known.length > 0 && known.every((id) => statuses.get(id) === 'pending')

  return (
    <TaskActionMenuShell
      open={Boolean(active && menu)}
      x={menu?.x ?? 0}
      y={menu?.y ?? 0}
    >
      {({ submenu, openSub, scheduleCloseSub, openLeft, close }) => {
        function setDue(daysFromNow: number | null) {
          const due =
            daysFromNow === null
              ? null
              : formatISO(addDays(startOfDay(new Date()), daysFromNow))
          bulkUpdate.mutate({
            ids,
            patch: {
              due_date: due,
              is_all_day: daysFromNow !== null ? true : undefined,
            },
          })
          close()
        }

        return (
          <>
            <p className="px-3 py-1.5 text-xs font-medium text-text-muted">
              {n} tasks selected
            </p>
            <Divider />

            <SharedMenuSections
              submenu={submenu}
              openSub={openSub}
              openLeft={openLeft}
              projects={projects}
              tags={tags}
              onSetDue={setDue}
              onSetPriority={(priority: Priority) => {
                bulkUpdate.mutate({ ids, patch: { priority } })
                close()
              }}
              onTagAction={(tagName) => {
                bulkUpdate.mutate({ ids, patch: { add_tags: [tagName] } })
                close()
              }}
              tagLabel={(name) => `Add #${name}`}
              onMoveToProject={(projectId) => {
                bulkUpdate.mutate({ ids, patch: { project_id: projectId } })
                close()
              }}
            />

            <Divider />
            <MenuItem
              label="Mark complete"
              disabled={allCompleted}
              onHover={scheduleCloseSub}
              onClick={() => {
                bulkComplete.mutate({ ids, completed: true })
                close()
              }}
            />
            <MenuItem
              label="Mark incomplete"
              disabled={allPending}
              onHover={scheduleCloseSub}
              onClick={() => {
                bulkComplete.mutate({ ids, completed: false })
                close()
              }}
            />
            <Divider />
            <MenuItem
              label="Delete"
              danger
              onHover={scheduleCloseSub}
              onClick={() => {
                if (window.confirm(`Delete ${n} tasks?`)) {
                  bulkDelete.mutate(ids)
                  clearSelection()
                }
                close()
              }}
            />
          </>
        )
      }}
    </TaskActionMenuShell>
  )
}
