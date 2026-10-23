import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateSectionInput, UpdateSectionInput } from '@shared/entities'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'

export function useSections(projectId: string | null | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.sections(projectId ?? ''),
    enabled: Boolean(projectId),
    queryFn: async () => {
      if (!projectId) return []
      return unwrapIpc(await ipc.sections.list(projectId))
    },
  })

  const invalidate = () => {
    if (projectId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sections(projectId) })
    }
    void queryClient.invalidateQueries({ queryKey: ['tasks'] })
  }

  const createSection = useMutation({
    mutationFn: async (input: CreateSectionInput) =>
      unwrapIpc(await ipc.sections.create(input)),
    onSuccess: invalidate,
  })

  const updateSection = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateSectionInput }) =>
      unwrapIpc(await ipc.sections.update(id, input)),
    onSuccess: invalidate,
  })

  const deleteSection = useMutation({
    mutationFn: async (id: string) => unwrapIpc(await ipc.sections.delete(id)),
    onSuccess: invalidate,
  })

  const reorderSections = useMutation({
    mutationFn: async ({
      projectId: pid,
      orderedIds,
    }: {
      projectId: string
      orderedIds: string[]
    }) => unwrapIpc(await ipc.sections.reorder(pid, orderedIds)),
    onSuccess: invalidate,
  })

  return {
    sections: query.data ?? [],
    isLoading: query.isLoading,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
  }
}
