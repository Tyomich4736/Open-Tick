import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc-client'
import { shouldSuppressTaskInvalidation } from '@/lib/taskQueryCache'

const TASK_INVALIDATE_DEBOUNCE_MS = 75

export function useIpcInvalidation(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    let taskTimer: ReturnType<typeof setTimeout> | null = null
    let pendingTaskInvalidate = false

    const flushTaskInvalidate = () => {
      taskTimer = null
      if (!pendingTaskInvalidate) return
      pendingTaskInvalidate = false
      if (shouldSuppressTaskInvalidation()) return
      void queryClient.invalidateQueries({
        queryKey: ['tasks'],
        refetchType: 'active',
      })
    }

    const unsub = ipc.onChanged((notification) => {
      if (notification.entityType === 'all') {
        void queryClient.invalidateQueries({ queryKey: ['tasks'], refetchType: 'active' })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
        void queryClient.invalidateQueries({ queryKey: ['folders'] })
        void queryClient.invalidateQueries({ queryKey: ['tags'] })
        return
      }
      if (notification.entityType === 'task') {
        if (shouldSuppressTaskInvalidation()) return
        pendingTaskInvalidate = true
        if (taskTimer) clearTimeout(taskTimer)
        taskTimer = setTimeout(flushTaskInvalidate, TASK_INVALIDATE_DEBOUNCE_MS)
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
      void queryClient.invalidateQueries({ queryKey: ['tasks'], refetchType: 'active' })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['folders'] })
      void queryClient.invalidateQueries({ queryKey: ['tags'] })
    })

    return () => {
      if (taskTimer) clearTimeout(taskTimer)
      unsub()
    }
  }, [queryClient])
}
