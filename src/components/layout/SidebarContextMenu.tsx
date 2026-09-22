import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { addDays, formatISO } from 'date-fns'
import type { ProjectFolder } from '@shared/entities'
import {
  useFolderExpanded,
  useFolderMutations,
  useInboxProject,
  useProjects,
} from '@/hooks/useProjects'
import { useProjectMutations, useTaskMutations } from '@/hooks/useTaskMutations'
import { useViewportMenuPosition } from '@/hooks/useViewportMenuPosition'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'

interface SidebarContextMenuProps {
  folders: ProjectFolder[]
}

export function SidebarContextMenu({ folders }: SidebarContextMenuProps) {
  const menu = useUiStore((s) => s.contextMenu)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const openFolderModal = useUiStore((s) => s.openFolderModal)
  const openProjectModal = useUiStore((s) => s.openProjectModal)
  const focusQuickAdd = useUiStore((s) => s.focusQuickAdd)
  const selectOne = useTaskSelectionStore((s) => s.selectOne)
  const { data: expandedMap = {} } = useFolderExpanded()
  const { deleteFolder, setExpanded } = useFolderMutations()
  const { updateProject, deleteProject } = useProjectMutations()
  const { createTask } = useTaskMutations()
  const { data: projects = [] } = useProjects()
  const inbox = useInboxProject(projects)

  const menuOpen = Boolean(menu && menu.type !== 'task')
  const { ref, style } = useViewportMenuPosition(
    menuOpen,
    menu?.x ?? 0,
    menu?.y ?? 0,
    180,
  )

  useEffect(() => {
    if (!menu || menu.type === 'task') return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu, setContextMenu, ref])

  if (!menu || menu.type === 'task') return null

  function close() {
    setContextMenu(null)
  }

  return createPortal(
    <div
      ref={ref}
      style={style}
      className="fixed z-50 min-w-44 rounded-lg border border-border bg-bg-primary py-1 shadow-xl"
    >
      {menu.type === 'smart' && (
        <>
          <MenuItem
            label="Add task"
            onClick={() => {
              const path = menu.path
              if (!inbox?.id) {
                focusQuickAdd()
                close()
                return
              }
              let due: string | null = null
              if (path === '/today') due = formatISO(new Date())
              if (path === '/tomorrow') due = formatISO(addDays(new Date(), 1))
              createTask.mutate(
                {
                  title: 'New task',
                  project_id: inbox.id,
                  due_date: due,
                },
                {
                  onSuccess: (task) => {
                    if (task) selectOne(task.id)
                  },
                },
              )
              focusQuickAdd()
              close()
            }}
          />
        </>
      )}

      {menu.type === 'folder' && (
        <>
          <MenuItem
            label="Add list"
            onClick={() => {
              openProjectModal(null, menu.id)
              close()
            }}
          />
          <MenuItem
            label="Rename"
            onClick={() => {
              openFolderModal(menu.id)
              close()
            }}
          />
          <MenuItem
            label={expandedMap[menu.id] === false ? 'Expand' : 'Collapse'}
            onClick={() => {
              const current = expandedMap[menu.id] ?? true
              setExpanded.mutate({ ...expandedMap, [menu.id]: !current })
              close()
            }}
          />
          <MenuItem
            label="Delete folder"
            danger
            onClick={() => {
              if (window.confirm('Delete this folder? Lists will move to the top level.')) {
                deleteFolder.mutate(menu.id)
              }
              close()
            }}
          />
        </>
      )}

      {menu.type === 'project' && (
        <>
          <MenuItem
            label="Add task"
            onClick={() => {
              createTask.mutate(
                { title: 'New task', project_id: menu.id },
                {
                  onSuccess: (task) => {
                    if (task) selectOne(task.id)
                  },
                },
              )
              focusQuickAdd()
              close()
            }}
          />
          <MenuItem
            label="Rename"
            onClick={() => {
              openProjectModal(menu.id)
              close()
            }}
          />
          <div className="my-1 border-t border-border" />
          <MenuItem
            label="Move to top level"
            onClick={() => {
              updateProject.mutate({ id: menu.id, input: { folder_id: null } })
              close()
            }}
          />
          {folders.map((folder) => (
            <MenuItem
              key={folder.id}
              label={`Move to ${folder.name}`}
              onClick={() => {
                updateProject.mutate({ id: menu.id, input: { folder_id: folder.id } })
                close()
              }}
            />
          ))}
          <div className="my-1 border-t border-border" />
          <MenuItem
            label="Delete list"
            danger
            onClick={() => {
              if (window.confirm('Delete this list and its tasks?')) {
                deleteProject.mutate(menu.id)
              }
              close()
            }}
          />
        </>
      )}
    </div>,
    document.body,
  )
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'block w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5',
        danger ? 'text-priority-high' : 'text-text-primary',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
