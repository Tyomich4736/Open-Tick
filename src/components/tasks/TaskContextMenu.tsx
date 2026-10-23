import type { Priority } from '@shared/entities'
import { useProjects } from '@/hooks/useProjects'
import { useSections } from '@/hooks/useSections'
import { useTags, useTaskDetail } from '@/hooks/useTasks'
import { useTaskMutations } from '@/hooks/useTaskMutations'
import { applyDueDaysFromNow } from '@shared/dueSchedule'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { TaskActionMenuShell } from '@/components/tasks/taskMenu/TaskActionMenuShell'
import { SharedMenuSections } from '@/components/tasks/taskMenu/sharedSections'
import { Divider, MenuItem } from '@/components/tasks/taskMenu/menuPrimitives'

export function TaskContextMenu() {
  const menu = useUiStore((s) => s.contextMenu)
  const focusSubtaskAdd = useUiStore((s) => s.focusSubtaskAdd)
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  const clearSelection = useTaskSelectionStore((s) => s.clear)
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const { updateTask, toggleComplete, deleteTask } = useTaskMutations()
  const { data: projects = [] } = useProjects()
  const { data: tags = [] } = useTags()
  const addToast = useToastStore((s) => s.addToast)

  const taskId = menu?.type === 'task' ? menu.id : null
  const { data: task } = useTaskDetail(taskId)
  const { sections } = useSections(task?.project_id)

  // Suppress single menu while bulk menu owns the interaction
  const isBulk =
    menu?.type === 'task' && selectedIds.length >= 2 && selectedIds.includes(menu.id)

  const menuOpen = Boolean(menu && menu.type === 'task' && task && !isBulk)

  // Narrow before shell so nested handlers see a definite TaskDetail
  if (!menuOpen || !task || !menu || menu.type !== 'task') return null

  const current = task

  return (
    <TaskActionMenuShell open x={menu.x} y={menu.y}>
      {({ submenu, openSub, scheduleCloseSub, openLeft, close }) => {
        function setDue(daysFromNow: number | null) {
          updateTask.mutate({
            id: current.id,
            input: applyDueDaysFromNow(
              {
                due_date: current.due_date,
                start_date: current.start_date,
                is_all_day: current.is_all_day,
              },
              daysFromNow,
            ),
          })
          close()
        }

        function setPriority(priority: Priority) {
          updateTask.mutate({ id: current.id, input: { priority } })
          close()
        }

        function toggleTag(name: string) {
          const next = current.tags.includes(name)
            ? current.tags.filter((t) => t !== name)
            : [...current.tags, name]
          updateTask.mutate({ id: current.id, input: { tags: next } })
        }

        async function duplicate() {
          const result = await ipc.tasks.duplicate(current.id)
          if (result.ok) {
            selectOne(result.data.id)
            addToast('Task duplicated', 'success')
          } else {
            addToast(result.error.message, 'error')
          }
          close()
        }

        async function openWindow() {
          const result = await ipc.tasks.openWindow(current.id)
          if (!result.ok) addToast(result.error.message, 'error')
          close()
        }

        async function pinAsSticky() {
          const result = await ipc.stickies.open(current.id)
          if (!result.ok) addToast(result.error.message, 'error')
          close()
        }

        async function copyLink() {
          const link = `${window.location.origin}${window.location.pathname}#/task-window/${current.id}`
          try {
            await navigator.clipboard.writeText(link)
            addToast('Link copied', 'success')
          } catch {
            addToast('Could not copy link', 'error')
          }
          close()
        }

        return (
          <>
            <SharedMenuSections
              submenu={submenu}
              openSub={openSub}
              openLeft={openLeft}
              projects={projects}
              tags={tags}
              onSetDue={setDue}
              onSetPriority={setPriority}
              onTagAction={toggleTag}
              isTagActive={(name) => current.tags.includes(name)}
              onMoveToProject={(projectId) => {
                updateTask.mutate({ id: current.id, input: { project_id: projectId } })
                close()
              }}
              isProjectActive={(id) => current.project_id === id}
              isPriorityActive={(p) => current.priority === p}
              sections={sections}
              onMoveToSection={(sectionId) => {
                updateTask.mutate({ id: current.id, input: { section_id: sectionId } })
                close()
              }}
              isSectionActive={(id) => (current.section_id ?? null) === id}
            />

            <Divider />
            <MenuItem
              label="Add subtask"
              onHover={scheduleCloseSub}
              onClick={() => {
                selectOne(current.id)
                focusSubtaskAdd()
                close()
              }}
            />
            <MenuItem label="Duplicate" onHover={scheduleCloseSub} onClick={() => void duplicate()} />
            <MenuItem label="Copy link" onHover={scheduleCloseSub} onClick={() => void copyLink()} />
            <MenuItem
              label="Open in new window"
              onHover={scheduleCloseSub}
              onClick={() => void openWindow()}
            />
            <MenuItem
              label="Open as sticky note"
              onHover={scheduleCloseSub}
              onClick={() => void pinAsSticky()}
            />
            <Divider />
            <MenuItem
              label={current.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
              onHover={scheduleCloseSub}
              onClick={() => {
                toggleComplete.mutate({
                  id: current.id,
                  completed: current.status === 'completed',
                })
                close()
              }}
            />
            <MenuItem
              label="Delete"
              danger
              onHover={scheduleCloseSub}
              onClick={() => {
                if (window.confirm(`Delete “${current.title}”?`)) {
                  deleteTask.mutate(current.id)
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
