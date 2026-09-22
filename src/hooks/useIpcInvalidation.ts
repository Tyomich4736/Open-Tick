import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc-client'

export function useIpcInvalidation(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    return ipc.onChanged((notification) => {
      if (notification.entityType === 'task') {
        void queryClient.invalidateQueries({
          queryKey: ['tasks'],
          // Keep showing cached rows while refetching — prevents list flash
          refetchType: 'active',
        })
        return
      }
      if (notification.entityType === 'project') {
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        return
      }
      if (notification.entityType === 'folder') {
        void queryClient.invalidateQueries({ queryKey: ['folders'] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        return
      }
      if (notification.entityType === 'tag') {
        void queryClient.invalidateQueries({ queryKey: ['tags'] })
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    })
  }, [queryClient])
}
