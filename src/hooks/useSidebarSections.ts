import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'

export type SidebarSectionId = 'projects' | 'tags'

const DEFAULT_SECTIONS: Record<SidebarSectionId, boolean> = {
  projects: true,
  tags: true,
}

export function useSidebarSections() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.settings('sidebar_sections_expanded'),
    queryFn: async () => {
      const result = await ipc.settings.get<Partial<Record<SidebarSectionId, boolean>>>(
        'sidebar_sections_expanded',
      )
      if (!result.ok) return { ...DEFAULT_SECTIONS }
      return { ...DEFAULT_SECTIONS, ...(result.data ?? {}) }
    },
  })

  const setSection = useMutation({
    mutationFn: async (map: Record<SidebarSectionId, boolean>) => {
      unwrapIpc(await ipc.settings.set('sidebar_sections_expanded', map))
      return map
    },
    onSuccess: (map) => {
      queryClient.setQueryData(queryKeys.settings('sidebar_sections_expanded'), map)
    },
  })

  return {
    sections: query.data ?? DEFAULT_SECTIONS,
    toggleSection: (id: SidebarSectionId) => {
      const current = query.data ?? DEFAULT_SECTIONS
      setSection.mutate({ ...current, [id]: !current[id] })
    },
  }
}
