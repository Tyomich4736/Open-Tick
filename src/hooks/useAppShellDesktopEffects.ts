import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ipc } from '@/lib/ipc-client'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { useToastStore } from '@/stores/toastStore'
import { useUiStore } from '@/stores/uiStore'

/** Desktop IPC side effects: hotkeys, task focus navigate, sticky create, toasts. */
export function useAppShellDesktopEffects(onTogglePalette: () => void) {
  const navigate = useNavigate()
  const setIntegrationOpen = useUiStore((s) => s.setIntegrationPanelOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onTogglePalette()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setIntegrationOpen(true)
        void ipc.sync.now().then((result) => {
          if (!result.ok) useToastStore.getState().addToast(result.error.message, 'error')
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onTogglePalette, setIntegrationOpen])

  useEffect(() => {
    const unsubFocus = ipc.onTaskFocus(({ taskId }) => {
      useTaskSelectionStore.getState().selectOne(taskId)
      void (async () => {
        const result = await ipc.tasks.get(taskId)
        if (result.ok) {
          navigate(`/project/${result.data.project_id}`)
        } else {
          navigate('/inbox')
        }
      })()
    })
    const unsubSticky = ipc.onDesktopNewSticky(() => {
      void (async () => {
        const selected = useTaskSelectionStore.getState().selectedIds[0]
        if (selected) {
          const result = await ipc.stickies.open(selected)
          if (!result.ok) useToastStore.getState().addToast(result.error.message, 'error')
          return
        }
        const projectList = await ipc.projects.list()
        if (!projectList.ok) {
          useToastStore.getState().addToast(projectList.error.message, 'error')
          return
        }
        const inbox = projectList.data.find((p) => p.is_inbox)
        if (!inbox) return
        const created = await ipc.tasks.create({
          title: 'New sticky note',
          project_id: inbox.id,
        })
        if (!created.ok) {
          useToastStore.getState().addToast(created.error.message, 'error')
          return
        }
        const sticky = await ipc.stickies.open(created.data.id)
        if (!sticky.ok) useToastStore.getState().addToast(sticky.error.message, 'error')
      })()
    })
    const unsubToast = ipc.onDesktopToast(({ message, type }) => {
      useToastStore.getState().addToast(message, type === 'error' ? 'error' : 'info')
    })
    return () => {
      unsubFocus()
      unsubSticky()
      unsubToast()
    }
  }, [navigate])
}
