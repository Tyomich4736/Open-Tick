import { useRef, useState } from 'react'
import { GripVertical, ListTree, Plus, Trash2 } from 'lucide-react'
import type { ProjectSection } from '@shared/entities'
import { useSections } from '@/hooks/useSections'

interface ManageSectionsButtonProps {
  projectId: string
}

export function ManageSectionsButton({ projectId }: ManageSectionsButtonProps) {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const { sections, createSection, updateSection, deleteSection, reorderSections } =
    useSections(projectId)

  const dragFrom = useRef<number | null>(null)
  const allowDrag = useRef(false)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [localOrder, setLocalOrder] = useState<ProjectSection[] | null>(null)

  const displaySections = localOrder ?? sections

  function startEdit(section: ProjectSection) {
    setEditingId(section.id)
    setEditName(section.name)
  }

  function commitEdit() {
    if (!editingId) return
    const name = editName.trim()
    if (name) {
      updateSection.mutate({ id: editingId, input: { name } })
    }
    setEditingId(null)
    setEditName('')
  }

  function addSection() {
    const name = draftName.trim()
    if (!name) return
    createSection.mutate({ project_id: projectId, name })
    setDraftName('')
  }

  function onDragStart(e: React.DragEvent, index: number) {
    if (!allowDrag.current || editingId) {
      e.preventDefault()
      return
    }
    dragFrom.current = index
    setLocalOrder(displaySections)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragFrom.current == null || dragFrom.current === index) {
      setOverIndex(null)
      return
    }
    setOverIndex(index)
  }

  function finishDrag(toIndex?: number) {
    const from = dragFrom.current
    dragFrom.current = null
    allowDrag.current = false
    setOverIndex(null)

    const base = localOrder ?? sections
    setLocalOrder(null)

    if (from == null || toIndex == null || from === toIndex) return
    const next = [...base]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(toIndex, 0, moved)
    setLocalOrder(next)
    reorderSections.mutate(
      { projectId, orderedIds: next.map((s) => s.id) },
      {
        onSettled: () => setLocalOrder(null),
      },
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
        aria-expanded={open}
        title="Manage sections"
      >
        <ListTree className="size-3.5" />
        Sections
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-bg-primary p-3 shadow-xl">
            <p className="mb-2 text-xs font-semibold text-text-muted uppercase tracking-wide">
              Manage sections
            </p>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto">
              {displaySections.length === 0 && (
                <li className="px-1 py-2 text-xs text-text-muted">No sections yet</li>
              )}
              {displaySections.map((section, index) => (
                <li
                  key={section.id}
                  draggable={!editingId}
                  onDragStart={(e) => onDragStart(e, index)}
                  onDragOver={(e) => onDragOver(e, index)}
                  onDrop={() => finishDrag(index)}
                  onDragEnd={() => finishDrag()}
                  className={[
                    'flex items-center gap-0.5 rounded-md px-0.5 py-0.5',
                    overIndex === index ? 'bg-accent/10' : 'hover:bg-black/5 dark:hover:bg-white/5',
                  ].join(' ')}
                >
                  <button
                    type="button"
                    className="cursor-grab touch-none rounded p-1 text-text-muted hover:text-text-primary active:cursor-grabbing"
                    aria-label={`Drag to reorder ${section.name}`}
                    title="Drag to reorder"
                    onMouseDown={() => {
                      allowDrag.current = true
                    }}
                    onMouseUp={() => {
                      allowDrag.current = false
                    }}
                  >
                    <GripVertical className="size-3.5" aria-hidden />
                  </button>
                  {editingId === section.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') {
                          setEditingId(null)
                          setEditName('')
                        }
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-transparent px-1.5 py-1 text-sm text-text-primary outline-none focus:border-accent"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(section)}
                      className="min-w-0 flex-1 truncate px-1.5 py-1 text-left text-sm text-text-primary"
                    >
                      {section.name}
                    </button>
                  )}
                  {section.is_default ? (
                    <span
                      className="rounded p-1 text-transparent"
                      title="Default section cannot be deleted"
                      aria-hidden
                    >
                      <Trash2 className="size-3.5" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      title="Delete section"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete section “${section.name}”? Tasks move to Not Sectioned.`,
                          )
                        ) {
                          deleteSection.mutate(section.id)
                        }
                      }}
                      className="rounded p-1 text-text-muted hover:bg-red-500/10 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5 border-t border-border pt-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSection()
                }}
                placeholder="New section"
                className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={addSection}
                disabled={!draftName.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
