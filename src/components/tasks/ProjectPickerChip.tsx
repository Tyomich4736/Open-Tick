import { useRef, useState } from 'react'
import { Check, ChevronDown, Folder } from 'lucide-react'
import type { Project } from '@shared/entities'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'

interface ProjectPickerChipProps {
  projectId: string
  projects: Project[]
  onChange: (projectId: string) => void
}

export function ProjectPickerChip({ projectId, projects, onChange }: ProjectPickerChipProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const project = projects.find((p) => p.id === projectId)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-primary px-2.5 py-1 text-xs text-text-muted hover:border-accent/40 hover:text-text-primary"
      >
        {project?.color ? (
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
        ) : (
          <Folder className="size-3 shrink-0 opacity-70" />
        )}
        <span className="max-w-[10rem] truncate">{project?.name ?? 'List'}</span>
        <ChevronDown className="size-3 shrink-0 opacity-60" />
      </button>

      <AnchoredPopover
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={192}
        className="max-h-56 min-w-[12rem] overflow-y-auto rounded-lg border border-border bg-bg-primary py-1 shadow-xl"
      >
        <ul role="listbox">
          {projects.map((p) => {
            const active = p.id === projectId
            return (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(p.id)
                    setOpen(false)
                  }}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5',
                    active ? 'font-medium text-accent' : 'text-text-primary',
                  ].join(' ')}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color || '#ccc' }}
                  />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {active && <Check className="size-3.5 shrink-0" />}
                </button>
              </li>
            )
          })}
        </ul>
      </AnchoredPopover>
    </>
  )
}
