import { useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Search, Settings } from 'lucide-react'
import type { Project } from '@shared/entities'
import {
  useFolders,
  useNonInboxProjects,
  useProjects,
} from '@/hooks/useProjects'
import { useTags } from '@/hooks/useTasks'
import { useSidebarSections } from '@/hooks/useSidebarSections'
import { useSidebarDnD } from '@/hooks/useSidebarDnD'
import { SidebarContextMenu } from './SidebarContextMenu'
import { SidebarSmartLists } from './sidebar/SidebarSmartLists'
import { SidebarProjects } from './sidebar/SidebarProjects'
import { SidebarTags } from './sidebar/SidebarTags'

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
  onOpenSearch,
}: {
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenSearch?: () => void
}) {
  const { data: projects = [] } = useProjects()
  const { data: folders = [] } = useFolders()
  const { data: tags = [] } = useTags()
  const { sections, toggleSection } = useSidebarSections()
  const userProjects = useNonInboxProjects(projects)
  const location = useLocation()
  const navigate = useNavigate()

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

  const dnd = useSidebarDnD({
    userProjects,
    folders,
    topLevelProjects,
    projectsByFolder,
  })

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
            <h1 className="truncate text-base font-semibold text-text-primary">Open Tick</h1>
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
        <SidebarSmartLists collapsed={collapsed} />

        {!collapsed && (
          <>
            <SidebarProjects
              collapsed={collapsed}
              folders={folders}
              topLevelProjects={topLevelProjects}
              projectsByFolder={projectsByFolder}
              projectsExpanded={sections.projects}
              onToggleProjectsSection={() => toggleSection('projects')}
              dnd={dnd}
            />
            <SidebarTags
              tags={tags}
              tagsExpanded={sections.tags}
              onToggleTagsSection={() => toggleSection('tags')}
            />
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
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
              e.preventDefault()
              void navigate('/settings')
            }
          }}
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
