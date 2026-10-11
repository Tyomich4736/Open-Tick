import { useRef, useState, type DragEvent } from 'react'
import type { Project, ProjectFolder } from '@shared/entities'
import { useFolderMutations } from '@/hooks/useProjects'
import { useProjectMutations } from '@/hooks/useTaskMutations'

export type SidebarDragPayload =
  | { kind: 'project'; id: string }
  | { kind: 'folder'; id: string }

export type SidebarDropTarget =
  | { kind: 'folder' | 'root' | 'project'; id: string }
  | null

interface UseSidebarDnDOptions {
  userProjects: Project[]
  folders: ProjectFolder[]
  topLevelProjects: Project[]
  projectsByFolder: Map<string, Project[]>
}

export function useSidebarDnD({
  userProjects,
  folders,
  topLevelProjects,
  projectsByFolder,
}: UseSidebarDnDOptions) {
  const { reorderFolders } = useFolderMutations()
  const { reorderProjects } = useProjectMutations()
  const dragRef = useRef<SidebarDragPayload | null>(null)
  const [drag, setDrag] = useState<SidebarDragPayload | null>(null)
  const [dropTarget, setDropTarget] = useState<SidebarDropTarget>(null)

  function clearDrag() {
    dragRef.current = null
    setDrag(null)
    setDropTarget(null)
  }

  function beginDrag(payload: SidebarDragPayload, e: DragEvent) {
    dragRef.current = payload
    setDrag(payload)
    e.dataTransfer.setData('application/x-opentick-drag', JSON.stringify(payload))
    e.dataTransfer.setData('text/plain', payload.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function readDrag(): SidebarDragPayload | null {
    return dragRef.current ?? drag
  }

  function onDropProjectOntoFolder(folderId: string | null) {
    const payload = readDrag()
    if (!payload || payload.kind !== 'project') return
    const project = userProjects.find((p) => p.id === payload.id)
    if (!project) return
    const alreadyThere =
      folderId === null ? project.folder_id == null : project.folder_id === folderId
    if (alreadyThere) {
      clearDrag()
      return
    }
    const siblings =
      folderId === null ? topLevelProjects : (projectsByFolder.get(folderId) ?? [])
    const ordered = siblings.map((p) => p.id).filter((id) => id !== payload.id)
    ordered.push(payload.id)
    reorderProjects.mutate({ orderedIds: ordered, folderId })
    clearDrag()
  }

  function onDropReorderFolder(targetId: string) {
    const payload = readDrag()
    if (!payload || payload.kind !== 'folder' || payload.id === targetId) return
    const ids = folders.map((f) => f.id)
    const from = ids.indexOf(payload.id)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, payload.id)
    reorderFolders.mutate(next)
    clearDrag()
  }

  function onDropReorderProject(target: Project, folderId: string | null) {
    const payload = readDrag()
    if (!payload || payload.kind !== 'project' || payload.id === target.id) return
    const siblings =
      folderId === null
        ? topLevelProjects
        : (projectsByFolder.get(folderId) ?? [])
    const ids = siblings.map((p) => p.id)
    const from = ids.indexOf(payload.id)
    const to = ids.indexOf(target.id)
    if (from < 0 || to < 0) {
      const ordered = [...ids]
      ordered.splice(to < 0 ? 0 : to, 0, payload.id)
      reorderProjects.mutate({ orderedIds: ordered, folderId })
      clearDrag()
      return
    }
    const next = [...ids]
    next.splice(from, 1)
    next.splice(to, 0, payload.id)
    reorderProjects.mutate({ orderedIds: next, folderId })
    clearDrag()
  }

  function allowProjectDrop(e: DragEvent) {
    const payload = readDrag()
    if (!payload || payload.kind !== 'project') return false
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    return true
  }

  return {
    drag,
    dropTarget,
    setDropTarget,
    clearDrag,
    beginDrag,
    readDrag,
    onDropProjectOntoFolder,
    onDropReorderFolder,
    onDropReorderProject,
    allowProjectDrop,
  }
}
