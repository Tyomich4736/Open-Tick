import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useFolders, useProjects } from '@/hooks/useProjects'
import { useLayoutSettings } from '@/hooks/useLayoutSettings'
import { useUiStore } from '@/stores/uiStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { Sidebar } from './Sidebar'
import { StatusBar } from './StatusBar'
import { ResizeHandle } from './ResizeHandle'
import { TaskDetailPanel } from '@/components/tasks/TaskDetailPanel'
import { TaskDetailPopup } from '@/components/tasks/TaskDetailPopup'
import { TaskPanelMultiSelect } from '@/components/tasks/TaskPanelMultiSelect'
import { FolderFormModal } from '@/components/projects/FolderFormModal'
import { ProjectFormModal } from '@/components/projects/ProjectFormModal'
import { ToastContainer } from '@/components/ui/ToastContainer'
import { TaskContextMenu } from '@/components/tasks/TaskContextMenu'
import { BulkTaskContextMenu } from '@/components/tasks/BulkTaskContextMenu'
import { CommandPalette } from '@/components/CommandPalette'
import { IntegrationPanel } from '@/components/sync/IntegrationPanel'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'

function DetailColumn() {
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  if (selectedIds.length >= 2) return <TaskPanelMultiSelect />
  return <TaskDetailPanel />
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: projects = [] } = useProjects()
  const { data: folders = [] } = useFolders()
  const editingProjectId = useUiStore((s) => s.editingProjectId)
  const editingFolderId = useUiStore((s) => s.editingFolderId)
  const editingProject = projects.find((p) => p.id === editingProjectId) ?? null
  const editingFolder = folders.find((f) => f.id === editingFolderId) ?? null
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const [resizingDetail, setResizingDetail] = useState(false)
  const setIntegrationOpen = useUiStore((s) => s.setIntegrationPanelOpen)

  const {
    ready,
    sidebarWidth,
    detailWidth,
    sidebarCollapsed,
    effectiveSidebarWidth,
    setSidebarWidth,
    setDetailWidth,
    setSidebarCollapsed,
    resetSidebarWidth,
    resetDetailWidth,
  } = useLayoutSettings()

  const isSettings = location.pathname.startsWith('/settings')
  const isCalendar = location.pathname.startsWith('/calendar')
  const isTaskWindow = location.pathname.startsWith('/task-window')
  const isSticky = location.pathname.startsWith('/sticky')
  const showDetailPanel = !isSettings && !isCalendar

  useEffect(() => {
    if (!isCalendar) useCalendarStore.getState().closeTaskPopup()
  }, [isCalendar])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
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
  }, [setIntegrationOpen])

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

  if (isTaskWindow || isSticky) {
    return (
      <>
        <Outlet />
        <ToastContainer />
      </>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1">
          <div
            style={{ width: effectiveSidebarWidth }}
            className={[
              'shrink-0 overflow-hidden',
              // Animate collapse/expand only — not while dragging (matches detail panel).
              ready && !resizingSidebar
                ? 'transition-[width] duration-200 ease-out motion-reduce:transition-none'
                : '',
            ].join(' ')}
          >
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              onOpenSearch={() => setPaletteOpen(true)}
            />
          </div>

          {!sidebarCollapsed && (
            <ResizeHandle
              aria-label="Resize sidebar"
              onResize={(delta) => setSidebarWidth(sidebarWidth + delta)}
              onReset={resetSidebarWidth}
              onDraggingChange={setResizingSidebar}
            />
          )}

          <div className="flex min-w-0 flex-1" style={{ minWidth: 280 }}>
            <main className="flex min-w-0 flex-1 flex-col bg-bg-primary">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <Outlet />
              </div>
              <StatusBar />
            </main>

            {showDetailPanel && (
              <>
                <ResizeHandle
                  aria-label="Resize detail panel"
                  invert
                  onResize={(delta) => setDetailWidth(detailWidth + delta)}
                  onReset={resetDetailWidth}
                  onDraggingChange={setResizingDetail}
                />
                <div
                  style={{ width: detailWidth }}
                  className={[
                    'shrink-0 overflow-hidden',
                    ready && !resizingDetail
                      ? 'transition-[width] duration-200 ease-out motion-reduce:transition-none'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <DetailColumn />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <ProjectFormModal project={editingProject} folders={folders} />
      <FolderFormModal folder={editingFolder} />
      {isCalendar && <TaskDetailPopup />}
      <TaskContextMenu />
      <BulkTaskContextMenu />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <IntegrationPanel />
      <ToastContainer />
    </>
  )
}
