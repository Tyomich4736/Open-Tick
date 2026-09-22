import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { TaskContextMenu } from '@/components/tasks/TaskContextMenu'
import { useTaskDetail } from '@/hooks/useTasks'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

export function TaskWindowPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const id = taskId ? decodeURIComponent(taskId) : null
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const { data: task } = useTaskDetail(id)

  useEffect(() => {
    if (id) selectOne(id)
  }, [id, selectOne])

  useEffect(() => {
    if (task?.title) {
      document.title = task.title
    }
  }, [task?.title])

  if (!id) {
    return <div className="p-6 text-text-muted">Missing task</div>
  }

  return (
    <div className="flex h-full flex-col bg-bg-primary">
      <TaskDetailPanel taskId={id} hideClose />
      <TaskContextMenu />
    </div>
  )
}
