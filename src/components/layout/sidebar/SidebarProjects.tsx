import { ChevronRight, Folder, Plus } from 'lucide-react'
import type { Project, ProjectFolder } from '@shared/entities'
import { useFolderExpanded, useFolderMutations } from '@/hooks/useProjects'
import { Collapse } from '@/components/ui/Collapse'
import { useUiStore } from '@/stores/uiStore'
import type { useSidebarDnD } from '@/hooks/useSidebarDnD'
import { SectionHeader, SidebarItem } from './SidebarItem'

type SidebarDnD = ReturnType<typeof useSidebarDnD>

interface SidebarProjectsProps {
  collapsed: boolean
  folders: ProjectFolder[]
  topLevelProjects: Project[]
  projectsByFolder: Map<string, Project[]>
  projectsExpanded: boolean
  onToggleProjectsSection: () => void
  dnd: SidebarDnD
}

export function SidebarProjects({
  collapsed,
  folders,
  topLevelProjects,
  projectsByFolder,
  projectsExpanded,
  onToggleProjectsSection,
  dnd,
}: SidebarProjectsProps) {
  const openProjectModal = useUiStore((s) => s.openProjectModal)
  const openFolderModal = useUiStore((s) => s.openFolderModal)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const { data: expandedMap = {} } = useFolderExpanded()
  const { setExpanded } = useFolderMutations()

  function isExpanded(folderId: string): boolean {
    return expandedMap[folderId] ?? true
  }

  function toggleFolder(folderId: string) {
    setExpanded.mutate({ ...expandedMap, [folderId]: !isExpanded(folderId) })
  }

  function renderProject(project: Project, depth: number, folderId: string | null) {
    const highlight =
      dnd.dropTarget?.kind === 'project' &&
      dnd.dropTarget.id === project.id &&
      dnd.drag?.kind === 'project' &&
      dnd.drag.id !== project.id

    return (
      <li key={project.id}>
        <SidebarItem
          to={`/project/${project.id}`}
          label={project.name}
          color={project.color}
          depth={depth}
          collapsed={collapsed}
          draggable={!collapsed}
          dropHighlight={Boolean(highlight)}
          onDragStart={(e) => dnd.beginDrag({ kind: 'project', id: project.id }, e)}
          onDragEnd={dnd.clearDrag}
          onDragOver={(e) => {
            if (!dnd.allowProjectDrop(e)) return
            e.stopPropagation()
            dnd.setDropTarget({ kind: 'project', id: project.id })
          }}
          onDragLeave={() => {
            dnd.setDropTarget((current) =>
              current?.kind === 'project' && current.id === project.id ? null : current,
            )
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            dnd.onDropReorderProject(project, folderId)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ type: 'project', id: project.id, x: e.clientX, y: e.clientY })
          }}
        />
      </li>
    )
  }

  function renderFolder(folder: ProjectFolder) {
    const expanded = isExpanded(folder.id)
    const children = projectsByFolder.get(folder.id) ?? []
    const folderDropActive =
      dnd.dropTarget?.kind === 'folder' &&
      dnd.dropTarget.id === folder.id &&
      dnd.drag?.kind === 'project'

    return (
      <li key={folder.id}>
        <div
          draggable
          onDragStart={(e) => dnd.beginDrag({ kind: 'folder', id: folder.id }, e)}
          onDragEnd={dnd.clearDrag}
          onDragOver={(e) => {
            const payload = dnd.readDrag()
            if (!payload) return
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
            if (payload.kind === 'project') {
              dnd.setDropTarget({ kind: 'folder', id: folder.id })
            }
          }}
          onDragLeave={() => {
            dnd.setDropTarget((current) =>
              current?.kind === 'folder' && current.id === folder.id ? null : current,
            )
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const payload = dnd.readDrag()
            if (payload?.kind === 'folder') dnd.onDropReorderFolder(folder.id)
            else dnd.onDropProjectOntoFolder(folder.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ type: 'folder', id: folder.id, x: e.clientX, y: e.clientY })
          }}
          className={[
            'group relative flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/5',
            folderDropActive ? 'bg-accent/15 ring-1 ring-inset ring-accent/40' : '',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={() => toggleFolder(folder.id)}
            className="rounded p-1 text-text-muted"
            aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
          >
            <ChevronRight
              className={[
                'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                expanded ? 'rotate-90' : 'rotate-0',
              ].join(' ')}
            />
          </button>
          <button
            type="button"
            onDoubleClick={() => openFolderModal(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3 text-left text-sm text-text-primary"
          >
            <Folder className="size-4 shrink-0 opacity-70" />
            <span className="truncate font-medium">{folder.name}</span>
            <span className="text-xs text-text-muted">{children.length}</span>
          </button>
        </div>
        <Collapse open={expanded}>
          <ul
            className={[
              'min-h-2 space-y-0.5 rounded-lg',
              folderDropActive ? 'bg-accent/5' : '',
            ].join(' ')}
            onDragOver={(e) => {
              if (!dnd.allowProjectDrop(e)) return
              e.stopPropagation()
              dnd.setDropTarget({ kind: 'folder', id: folder.id })
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dnd.onDropProjectOntoFolder(folder.id)
            }}
          >
            {children.map((project) => renderProject(project, 1, folder.id))}
          </ul>
        </Collapse>
      </li>
    )
  }

  return (
    <div className="mt-5">
      <SectionHeader
        label="Lists"
        expanded={projectsExpanded}
        onToggle={onToggleProjectsSection}
      />
      <Collapse open={projectsExpanded}>
        <ul
          className={[
            'min-h-2 space-y-0.5 rounded-lg',
            dnd.dropTarget?.kind === 'root' && dnd.drag?.kind === 'project'
              ? 'bg-accent/5 ring-1 ring-inset ring-accent/30'
              : '',
          ].join(' ')}
          onDragOver={(e) => {
            if (!dnd.allowProjectDrop(e)) return
            dnd.setDropTarget({ kind: 'root', id: 'root' })
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            dnd.setDropTarget((current) => (current?.kind === 'root' ? null : current))
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (dnd.readDrag()?.kind === 'project') dnd.onDropProjectOntoFolder(null)
          }}
        >
          {folders.map((folder) => renderFolder(folder))}
          {topLevelProjects.map((project) => renderProject(project, 0, null))}
        </ul>

        <div className="mt-2 space-y-0.5">
          <button
            type="button"
            onClick={() => openProjectModal()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
          >
            <Plus className="size-4" />
            New List
          </button>
          <button
            type="button"
            onClick={() => openFolderModal()}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
          >
            <Folder className="size-4" />
            New Folder
          </button>
        </div>
      </Collapse>
    </div>
  )
}
