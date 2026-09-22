import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  BulkTaskPatch,
  CreateProjectInput,
  CreateTaskInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@shared/entities'
import { ipc } from '@/lib/ipc-client'
import { ipcCall } from '@/lib/ipcResult'
import { useToastStore } from '@/stores/toastStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

export function useTaskMutations() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const createTask = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      ipcCall(() => ipc.tasks.create(input), 'Failed to create task'),
    onSuccess: (task) => {
      invalidate()
      if (task) {
        useTaskSelectionStore.getState().selectOne(task.id)
        addToast('Task created', 'success')
      }
    },
  })

  const duplicateTask = useMutation({
    mutationFn: (id: string) => ipcCall(() => ipc.tasks.duplicate(id), 'Failed to duplicate task'),
    onSuccess: (task) => {
      invalidate()
      if (task) {
        useTaskSelectionStore.getState().selectOne(task.id)
        addToast('Task duplicated', 'success')
      }
    },
  })

  const updateTask = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      ipcCall(() => ipc.tasks.update(id, input), 'Failed to update task'),
    // Cache refresh comes once from sync:changed — avoid a second invalidate that flashes the list
  })

  const toggleComplete = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      ipcCall(
        () => (completed ? ipc.tasks.uncomplete(id) : ipc.tasks.complete(id)),
        'Failed to update task',
      ),
    onSuccess: invalidate,
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => ipcCall(() => ipc.tasks.delete(id), 'Failed to delete task'),
    onSuccess: () => {
      invalidate()
      useTaskSelectionStore.getState().clear()
      addToast('Task deleted', 'success')
    },
  })

  const reorderTasks = useMutation({
    mutationFn: (orderedIds: string[]) =>
      ipcCall(() => ipc.tasks.reorder(orderedIds), 'Failed to reorder tasks'),
    onSuccess: invalidate,
  })

  const bulkUpdate = useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: BulkTaskPatch }) =>
      ipcCall(() => ipc.tasks.bulkUpdate(ids, patch), 'Failed to update tasks'),
    onSuccess: (tagsById, vars) => {
      if (tagsById) {
        queryClient.setQueriesData({ queryKey: ['tasks'] }, (old) => {
          if (!Array.isArray(old)) return old
          return old.map((item: { id: string; tags?: string[] }) => {
            const tags = tagsById[item.id]
            return tags ? { ...item, tags } : item
          })
        })
      }
      invalidate()
      const n = vars.ids.length
      if (vars.patch.project_id) {
        useTaskSelectionStore.getState().clear()
        addToast(`Moved ${n} task${n === 1 ? '' : 's'}`, 'success')
      } else if (vars.patch.priority !== undefined) {
        addToast(`Updated priority on ${n} task${n === 1 ? '' : 's'}`, 'success')
      } else if (vars.patch.due_date !== undefined || vars.patch.is_all_day !== undefined) {
        addToast(`Updated date on ${n} task${n === 1 ? '' : 's'}`, 'success')
      } else if (vars.patch.add_tags?.length || vars.patch.remove_tags?.length) {
        addToast(`Updated tags on ${n} task${n === 1 ? '' : 's'}`, 'success')
      } else {
        addToast(`Updated ${n} task${n === 1 ? '' : 's'}`, 'success')
      }
    },
  })

  const bulkComplete = useMutation({
    mutationFn: ({ ids, completed }: { ids: string[]; completed: boolean }) =>
      ipcCall(() => ipc.tasks.bulkComplete(ids, completed), 'Failed to update tasks'),
    onSuccess: (_data, vars) => {
      invalidate()
      const n = vars.ids.length
      addToast(
        vars.completed
          ? `Completed ${n} task${n === 1 ? '' : 's'}`
          : `Marked ${n} task${n === 1 ? '' : 's'} incomplete`,
        'success',
      )
    },
  })

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      ipcCall(() => ipc.tasks.bulkDelete(ids), 'Failed to delete tasks'),
    onSuccess: (_data, ids) => {
      invalidate()
      useTaskSelectionStore.getState().clear()
      const n = ids.length
      addToast(`Deleted ${n} task${n === 1 ? '' : 's'}`, 'success')
    },
  })

  return {
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
    reorderTasks,
    duplicateTask,
    bulkUpdate,
    bulkComplete,
    bulkDelete,
  }
}

export function useProjectMutations() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
    void queryClient.invalidateQueries({ queryKey: ['folders'] })
  }

  const createProject = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      ipcCall(() => ipc.projects.create(input), 'Failed to create list'),
    onSuccess: (project) => {
      invalidate()
      if (project) addToast('List created', 'success')
    },
  })

  const updateProject = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      ipcCall(() => ipc.projects.update(id, input), 'Failed to update list'),
    onSuccess: () => {
      invalidate()
      addToast('List updated', 'success')
    },
  })

  const deleteProject = useMutation({
    mutationFn: (id: string) => ipcCall(() => ipc.projects.delete(id), 'Failed to delete list'),
    onSuccess: () => {
      invalidate()
      addToast('List deleted', 'success')
    },
  })

  const reorderProjects = useMutation({
    mutationFn: ({
      orderedIds,
      folderId,
    }: {
      orderedIds: string[]
      folderId?: string | null
    }) => ipcCall(() => ipc.projects.reorder(orderedIds, folderId ?? null), 'Failed to reorder'),
    onSuccess: invalidate,
  })

  return { createProject, updateProject, deleteProject, reorderProjects }
}
