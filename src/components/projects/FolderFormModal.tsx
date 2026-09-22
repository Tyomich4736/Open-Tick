import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectFolder } from '@shared/entities'
import { useFolderMutations } from '@/hooks/useProjects'
import { useUiStore } from '@/stores/uiStore'

interface FolderFormModalProps {
  folder?: ProjectFolder | null
}

export function FolderFormModal({ folder }: FolderFormModalProps) {
  const open = useUiStore((s) => s.folderModalOpen)
  const closeFolderModal = useUiStore((s) => s.closeFolderModal)
  const { createFolder, updateFolder, deleteFolder } = useFolderMutations()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName(folder?.name ?? '')
  }, [open, folder])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-primary p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">
            {folder ? 'Rename folder' : 'New folder'}
          </h2>
          <button type="button" onClick={closeFolderModal} aria-label="Close">
            <X className="size-5 text-text-muted" />
          </button>
        </div>

        <label className="mb-1 block text-xs font-medium text-text-muted">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-6 w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              if (folder) {
                updateFolder.mutate({ id: folder.id, input: { name: name.trim() } })
              } else {
                createFolder.mutate({ name: name.trim() })
              }
              closeFolderModal()
            }
          }}
        />

        <div className="flex justify-between gap-2">
          {folder ? (
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-priority-high hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => {
                deleteFolder.mutate(folder.id)
                closeFolderModal()
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
              onClick={closeFolderModal}
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
                if (folder) {
                  updateFolder.mutate({ id: folder.id, input: { name: name.trim() } })
                } else {
                  createFolder.mutate({ name: name.trim() })
                }
                closeFolderModal()
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
