import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useFolders, useProjects } from '@/hooks/useProjects'
import { useLayoutSettings } from '@/hooks/useLayoutSettings'
import { useAppShellDesktopEffects } from '@/hooks/useAppShellDesktopEffects'
import { useUiStore } from '@/stores/uiStore'
import { useCalendarStore } from '@/stores/calendarStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
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

function DetailColumn() {
  const selectedIds = useTaskSelectionStore((s) => s.selectedIds)
  if (selectedIds.length >= 2) return <TaskPanelMultiSelect />
  return <TaskDetailPanel />
}

export function AppShell() {
  const location = useLocation()
  const { data: projects = [] } = useProjects()
  const { data: folders = [] } = useFolders()
  const editingProjectId = useUiStore((s) => s.editingProjectId)
  const editingFolderId = useUiStore((s) => s.editingFolderId)
  const editingProject = projects.find((p) => p.id === editingProjectId) ?? null
  const editingFolder = folders.find((f) => f.id === editingFolderId) ?? null
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [resizingSidebar, setResizingSidebar] = useState(false)
  const [resizingDetail, setResizingDetail] = useState(false)
  const togglePalette = useCallback(() => setPaletteOpen((open) => !open), [])

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

  useAppShellDesktopEffects(togglePalette)

  useEffect(() => {
    if (!isCalendar) useCalendarStore.getState().closeTaskPopup()
  }, [isCalendar])

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
