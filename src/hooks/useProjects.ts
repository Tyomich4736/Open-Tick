import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateFolderInput, Project, UpdateFolderInput } from '@shared/entities'
import { ipc } from '@/lib/ipc-client'
import { ipcCall, unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'
import { useToastStore } from '@/stores/toastStore'

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: async () => unwrapIpc(await ipc.projects.list()),
  })
}

export function useFolders() {
  return useQuery({
    queryKey: queryKeys.folders,
    queryFn: async () => unwrapIpc(await ipc.folders.list()),
  })
}

export function useInboxProject(projects: Project[] | undefined): Project | undefined {
  return projects?.find((p) => p.is_inbox)
}

export function useNonInboxProjects(projects: Project[] | undefined): Project[] {
  return projects?.filter((p) => !p.is_inbox) ?? []
}

export function useFolderExpanded() {
  return useQuery({
    queryKey: queryKeys.settings('folder_expanded'),
    queryFn: async () => {
      const result = await ipc.settings.get<Record<string, boolean>>('folder_expanded')
      if (!result.ok) return {} as Record<string, boolean>
      return result.data ?? {}
    },
  })
}

export function useFolderMutations() {
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['folders'] })
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const createFolder = useMutation({
    mutationFn: (input: CreateFolderInput) =>
      ipcCall(() => ipc.folders.create(input), 'Failed to create folder'),
    onSuccess: (folder) => {
      invalidate()
      if (folder) addToast('Folder created', 'success')
    },
  })

  const updateFolder = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateFolderInput }) =>
      ipcCall(() => ipc.folders.update(id, input), 'Failed to update folder'),
    onSuccess: () => {
      invalidate()
      addToast('Folder updated', 'success')
    },
  })

  const deleteFolder = useMutation({
    mutationFn: (id: string) => ipcCall(() => ipc.folders.delete(id), 'Failed to delete folder'),
    onSuccess: () => {
      invalidate()
      addToast('Folder deleted — lists moved to top level', 'success')
    },
  })

  const reorderFolders = useMutation({
    mutationFn: (orderedIds: string[]) =>
      ipcCall(() => ipc.folders.reorder(orderedIds), 'Failed to reorder folders'),
    onSuccess: invalidate,
  })

  const setExpanded = useMutation({
    mutationFn: async (map: Record<string, boolean>) => {
      unwrapIpc(await ipc.settings.set('folder_expanded', map))
      return map
    },
    onSuccess: (map) => {
      queryClient.setQueryData(queryKeys.settings('folder_expanded'), map)
    },
  })

  return { createFolder, updateFolder, deleteFolder, reorderFolders, setExpanded }
}
