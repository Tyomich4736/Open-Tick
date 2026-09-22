import { useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  BulkTaskPatch,
  CreateProjectInput,
  CreateTaskInput,
  TaskStatus,
  UpdateProjectInput,
  UpdateTaskInput,
} from '@shared/entities'
import { ipc } from '@/lib/ipc-client'
import { ipcCall } from '@/lib/ipcResult'
import {
  invalidateTaskQueries,
  reorderTaskListCaches,
  setTaskStatusInCaches,
  suppressTaskInvalidation,
} from '@/lib/taskQueryCache'
import { useToastStore } from '@/stores/toastStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

export function useTaskMutations() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const invalidateLists = () => {
    suppressTaskInvalidation()
    invalidateTaskQueries(queryClient)
  }

  const createTask = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      ipcCall(() => ipc.tasks.create(input), 'Failed to create task'),
    onSuccess: (task) => {
      invalidateLists()
      if (task) {
        useTaskSelectionStore.getState().selectOne(task.id)
        addToast('Task created', 'success')
      }
    },
  })

  const duplicateTask = useMutation({
    mutationFn: (id: string) => ipcCall(() => ipc.tasks.duplicate(id), 'Failed to duplicate task'),
    onSuccess: (task) => {
      invalidateLists()
      if (task) {
        useTaskSelectionStore.getState().selectOne(task.id)
        addToast('Task duplicated', 'success')
      }
    },
  })

  const updateTask = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      ipcCall(() => ipc.tasks.update(id, input), 'Failed to update task'),
    // Cache refresh comes from sync:changed (debounced) — avoid double list flash
  })

  const toggleComplete = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      ipcCall(
        () => (completed ? ipc.tasks.uncomplete(id) : ipc.tasks.complete(id)),
        'Failed to update task',
      ),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const nextStatus: TaskStatus = completed ? 'pending' : 'completed'
      setTaskStatusInCaches(queryClient, id, nextStatus)
      suppressTaskInvalidation(200)
      const previousStatus: TaskStatus = completed ? 'completed' : 'pending'
      return { id, previousStatus }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) setTaskStatusInCaches(queryClient, ctx.id, ctx.previousStatus)
    },
    onSuccess: (_data, { id }) => {
      suppressTaskInvalidation(200)
      void queryClient.invalidateQueries({
        queryKey: ['tasks', 'detail', id],
        refetchType: 'active',
      })
      // One list/count refresh so filtered smart lists drop completed rows (IPC notify suppressed)
      void queryClient.invalidateQueries({
        queryKey: ['tasks'],
        refetchType: 'active',
        predicate: (q) => q.queryKey[1] !== 'detail' && q.queryKey[1] !== 'subtasks',
      })
    },
  })

  const deleteTask = useMutation({
    mutationFn: (id: string) => ipcCall(() => ipc.tasks.delete(id), 'Failed to delete task'),
    onSuccess: () => {
      invalidateLists()
      useTaskSelectionStore.getState().clear()
      addToast('Task deleted', 'success')
    },
  })

  const reorderTasks = useMutation({
    mutationFn: (orderedIds: string[]) =>
      ipcCall(() => ipc.tasks.reorder(orderedIds), 'Failed to reorder tasks'),
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const previous = queryClient.getQueriesData<unknown>({ queryKey: ['tasks'] })
      reorderTaskListCaches(queryClient, orderedIds)
      suppressTaskInvalidation(200)
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.previous) return
      for (const [key, data] of ctx.previous) {
        queryClient.setQueryData(key, data)
      }
    },
    onSuccess: () => {
      suppressTaskInvalidation(200)
    },
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
      invalidateLists()
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
    onMutate: async ({ ids, completed }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] })
      const nextStatus = completed ? 'completed' : 'pending'
      for (const id of ids) setTaskStatusInCaches(queryClient, id, nextStatus)
      suppressTaskInvalidation(200)
    },
    onSuccess: (_data, vars) => {
      invalidateLists()
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
      invalidateLists()
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
