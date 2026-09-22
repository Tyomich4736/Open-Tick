import { useMemo, useState, type ComponentType, type DragEvent, type MouseEvent } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Folder,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sun,
  Tag,
} from 'lucide-react'
import type { Project, ProjectFolder } from '@shared/entities'
import {
  useFolderExpanded,
  useFolderMutations,
  useFolders,
  useNonInboxProjects,
  useProjects,
} from '@/hooks/useProjects'
import { useProjectMutations } from '@/hooks/useTaskMutations'
import { useTags, useTasks } from '@/hooks/useTasks'
import { Collapse } from '@/components/ui/Collapse'
import { useUiStore } from '@/stores/uiStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipc } from '@/lib/ipc-client'
import { unwrapIpc } from '@/lib/ipcResult'
import { queryKeys } from '@/lib/queryClient'
import { SidebarContextMenu } from './SidebarContextMenu'

type SidebarSectionId = 'projects' | 'tags'

const DEFAULT_SECTIONS: Record<SidebarSectionId, boolean> = {
  projects: true,
  tags: true,
}

function useSidebarSections() {
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

function SectionHeader({
  label,
  expanded,
  onToggle,
}: {
  label: string
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-1.5 flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs font-medium uppercase tracking-wide text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
      aria-expanded={expanded}
    >
      <ChevronRight
        className={[
          'size-3.5 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
          expanded ? 'rotate-90' : 'rotate-0',
        ].join(' ')}
      />
      <span className="flex-1">{label}</span>
    </button>
  )
}

function SidebarItem({
  to,
  label,
  icon: Icon,
  badge,
  color,
  depth = 0,
  collapsed,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onContextMenu,
}: {
  to: string
  label: string
  icon?: ComponentType<{ className?: string }>
  badge?: number
  color?: string
  depth?: number
  collapsed?: boolean
  draggable?: boolean
  onDragStart?: () => void
  onDragOver?: (e: DragEvent) => void
  onDrop?: () => void
  onContextMenu?: (e: MouseEvent) => void
}) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      style={{ paddingLeft: collapsed ? undefined : `${12 + depth * 14}px` }}
      className={({ isActive }) =>
        [
          'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
          collapsed ? 'justify-center px-2' : 'px-3',
          isActive
            ? 'bg-accent/10 font-medium text-accent'
            : 'text-text-primary hover:bg-black/5 dark:hover:bg-white/5',
        ].join(' ')
      }
    >
      {color ? (
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : (
        Icon && <Icon className="size-4 shrink-0 opacity-70" />
      )}
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-xs font-medium text-accent">
          {badge}
        </span>
      )}
    </NavLink>
  )
}

type DragPayload =
  | { kind: 'project'; id: string }
  | { kind: 'folder'; id: string }

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onOpenSearch,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenSearch?: () => void
}) {
  const openProjectModal = useUiStore((s) => s.openProjectModal)
  const openFolderModal = useUiStore((s) => s.openFolderModal)
  const setContextMenu = useUiStore((s) => s.setContextMenu)
  const { data: projects = [] } = useProjects()
  const { data: folders = [] } = useFolders()
  const { data: tags = [] } = useTags()
  const { data: expandedMap = {} } = useFolderExpanded()
  const { setExpanded, reorderFolders } = useFolderMutations()
  const { updateProject, reorderProjects } = useProjectMutations()
  const { sections, toggleSection } = useSidebarSections()
  const userProjects = useNonInboxProjects(projects)
  const { data: todayTasks = [] } = useTasks({ smart_list: 'today', parent_id: null })
  const { data: overdueTasks = [] } = useTasks({ smart_list: 'overdue', parent_id: null })
  const location = useLocation()
  const [drag, setDrag] = useState<DragPayload | null>(null)

  const topLevelProjects = useMemo(
    () => userProjects.filter((p) => !p.folder_id).sort((a, b) => a.sort_order - b.sort_order),
    [userProjects],
  )

  const projectsByFolder = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const folder of folders) map.set(folder.id, [])
    for (const project of userProjects) {
      if (!project.folder_id) continue
      const list = map.get(project.folder_id) ?? []
      list.push(project)
      map.set(project.folder_id, list)
    }
    for (const [id, list] of map) {
      map.set(
        id,
        [...list].sort((a, b) => a.sort_order - b.sort_order),
      )
    }
    return map
  }, [folders, userProjects])

  const smartLists = [
    { to: '/inbox', label: 'Inbox', icon: Inbox },
    { to: '/today', label: 'Today', icon: Sun, badge: todayTasks.length },
    { to: '/tomorrow', label: 'Tomorrow', icon: CalendarDays },
    { to: '/week', label: 'Next 7 Days', icon: CalendarRange },
    {
      to: '/overdue',
      label: 'Overdue',
      icon: AlertCircle,
      badge: overdueTasks.length,
    },
    { to: '/completed', label: 'Completed', icon: CheckCircle2 },
  ] as const

  function isExpanded(folderId: string): boolean {
    return expandedMap[folderId] ?? true
  }

  function toggleFolder(folderId: string) {
    setExpanded.mutate({ ...expandedMap, [folderId]: !isExpanded(folderId) })
  }

  function onDropProjectOntoFolder(folderId: string | null) {
    if (!drag || drag.kind !== 'project') return
    updateProject.mutate({ id: drag.id, input: { folder_id: folderId } })
    setDrag(null)
  }

  function onDropReorderFolder(targetId: string) {
    if (!drag || drag.kind !== 'folder' || drag.id === targetId) return
    const ids = folders.map((f) => f.id)
    const from = ids.indexOf(drag.id)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, drag.id)
    reorderFolders.mutate(next)
    setDrag(null)
  }

  function onDropReorderProject(target: Project, folderId: string | null) {
    if (!drag || drag.kind !== 'project' || drag.id === target.id) return
    const siblings =
      folderId === null
        ? topLevelProjects
        : (projectsByFolder.get(folderId) ?? [])
    const ids = siblings.map((p) => p.id)
    const from = ids.indexOf(drag.id)
    const to = ids.indexOf(target.id)
    if (from < 0 || to < 0) {
      const ordered = [...ids]
      ordered.splice(to < 0 ? 0 : to, 0, drag.id)
      reorderProjects.mutate({ orderedIds: ordered, folderId })
      setDrag(null)
      return
    }
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, drag.id)
    reorderProjects.mutate({ orderedIds: next, folderId })
    setDrag(null)
  }

  function renderProject(project: Project, depth: number, folderId: string | null) {
    return (
      <li key={project.id}>
        <SidebarItem
          to={`/project/${project.id}`}
          label={project.name}
          color={project.color}
          depth={depth}
          collapsed={collapsed}
          draggable={!collapsed}
          onDragStart={() => setDrag({ kind: 'project', id: project.id })}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDropReorderProject(project, folderId)}
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

    return (
      <li key={folder.id}>
        <div
          draggable
          onDragStart={() => setDrag({ kind: 'folder', id: folder.id })}
          onDragOver={(e) => {
            e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (drag?.kind === 'folder') onDropReorderFolder(folder.id)
            else onDropProjectOntoFolder(folder.id)
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setContextMenu({ type: 'folder', id: folder.id, x: e.clientX, y: e.clientY })
          }}
          className="group relative flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/5"
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
            className="space-y-0.5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              onDropProjectOntoFolder(folder.id)
            }}
          >
            {children.map((project) => renderProject(project, 1, folder.id))}
          </ul>
        </Collapse>
      </li>
    )
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-bg-sidebar">
      <div
        className={[
          'flex items-center border-b border-border',
          collapsed ? 'justify-center px-1 py-3' : 'justify-between px-3 py-3',
        ].join(' ')}
      >
        {!collapsed && (
          <div className="min-w-0 px-1">
            <h1 className="truncate text-base font-semibold text-text-primary">TickTick Clone</h1>
            <p className="mt-0.5 truncate text-xs text-text-muted">Local-first task manager</p>
          </div>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-lg p-2 text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {!collapsed && (
          <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wide text-text-muted">
            Smart lists
          </p>
        )}
        <ul className="space-y-0.5">
          {smartLists.map((item) => (
            <li key={item.to}>
              <SidebarItem
                {...item}
                collapsed={collapsed}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setContextMenu({
                    type: 'smart',
                    path: item.to,
                    label: item.label,
                    x: e.clientX,
                    y: e.clientY,
                  })
                }}
              />
            </li>
          ))}
        </ul>

        {!collapsed && (
          <>
            <div className="mt-5">
              <SectionHeader
                label="Lists"
                expanded={sections.projects}
                onToggle={() => toggleSection('projects')}
              />
              <Collapse open={sections.projects}>
                <ul
                  className="space-y-0.5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (drag?.kind === 'project') onDropProjectOntoFolder(null)
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

            <div className="mt-5">
              <SectionHeader
                label="Tags"
                expanded={sections.tags}
                onToggle={() => toggleSection('tags')}
              />
              <Collapse open={sections.tags}>
                <ul className="space-y-0.5">
                  {tags.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-text-muted">No tags yet</li>
                  ) : (
                    tags.map((tag) => (
                      <li key={tag.id}>
                        <SidebarItem
                          to={`/tag/${encodeURIComponent(tag.name)}`}
                          label={tag.name}
                          icon={Tag}
                        />
                      </li>
                    ))
                  )}
                </ul>
              </Collapse>
            </div>
          </>
        )}
      </nav>

      <div className="space-y-0.5 border-t border-border px-2 py-3">
        <button
          type="button"
          title={collapsed ? 'Search' : undefined}
          onClick={() => onOpenSearch?.()}
          className={[
            'flex w-full items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
            collapsed ? 'justify-center px-2' : 'px-3',
            'text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5',
          ].join(' ')}
        >
          <Search className="size-4" />
          {!collapsed && 'Search'}
        </button>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) =>
            [
              'flex items-center gap-2.5 rounded-lg py-2 text-sm transition-colors',
              collapsed ? 'justify-center px-2' : 'px-3',
              isActive || location.pathname === '/settings'
                ? 'bg-accent/10 font-medium text-accent'
                : 'text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5',
            ].join(' ')
          }
        >
          <Settings className="size-4" />
          {!collapsed && 'Settings'}
        </NavLink>
      </div>

      <SidebarContextMenu folders={folders} />
    </aside>
  )
}
