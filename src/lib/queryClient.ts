import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  folders: ['folders'] as const,
  sections: (projectId: string) => ['sections', projectId] as const,
  tasks: (filter: Record<string, unknown>) => ['tasks', filter] as const,
  taskCount: (filter: Record<string, unknown>) => ['tasks', 'count', filter] as const,
  task: (id: string) => ['tasks', 'detail', id] as const,
  subtasks: (parentId: string) => ['tasks', 'subtasks', parentId] as const,
  tags: ['tags'] as const,
  settings: (key: string) => ['settings', key] as const,
}
