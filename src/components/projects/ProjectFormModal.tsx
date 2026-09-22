import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Project, ProjectFolder } from '@shared/entities'
import { useProjectMutations } from '@/hooks/useTaskMutations'
import { useUiStore } from '@/stores/uiStore'

const COLORS = ['#4772FA', '#FE7777', '#FFAF38', '#34C759', '#AF52DE', '#5AC8FA']

interface ProjectFormModalProps {
  project?: Project | null
  folders?: ProjectFolder[]
}

export function ProjectFormModal({ project, folders = [] }: ProjectFormModalProps) {
  const open = useUiStore((s) => s.projectModalOpen)
  const closeProjectModal = useUiStore((s) => s.closeProjectModal)
  const defaultFolderId = useUiStore((s) => s.defaultFolderId)
  const { createProject, updateProject, deleteProject } = useProjectMutations()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [folderId, setFolderId] = useState<string>('')

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '')
      setColor(project?.color ?? COLORS[0])
      setFolderId(project?.folder_id ?? defaultFolderId ?? '')
    }
  }, [open, project, defaultFolderId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-primary p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {project ? 'Edit list' : 'New list'}
          </h2>
          <button type="button" onClick={closeProjectModal} aria-label="Close">
            <X className="size-5 text-text-muted" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-text-muted">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          autoFocus
        />

        <label className="mb-1 block text-xs font-medium text-text-muted">Folder</label>
        <select
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
          disabled={!!project?.is_inbox}
        >
          <option value="">None (top level)</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>

        <label className="mb-2 block text-xs font-medium text-text-muted">Color</label>
        <div className="mb-6 flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={[
                'size-8 rounded-full border-2',
                color === c ? 'border-text-primary' : 'border-transparent',
              ].join(' ')}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        <div className="flex justify-between gap-2">
          {project && !project.is_inbox ? (
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-priority-high hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => {
                deleteProject.mutate(project.id)
                closeProjectModal()
              }}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeProjectModal}
              className="rounded-lg px-4 py-2 text-sm text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              onClick={() => {
                if (!name.trim()) return
                const nextFolderId = folderId || null
                if (project) {
                  updateProject.mutate({
                    id: project.id,
                    input: { name: name.trim(), color, folder_id: nextFolderId },
                  })
                } else {
                  createProject.mutate({
                    name: name.trim(),
                    color,
                    folder_id: nextFolderId,
                  })
                }
                closeProjectModal()
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
