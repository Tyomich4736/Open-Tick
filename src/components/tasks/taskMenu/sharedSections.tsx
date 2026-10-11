import type { Priority, Project, Tag } from '@shared/entities'
import { priorityLabels } from '@/lib/priority'
import type { TaskMenuSubmenu } from './TaskActionMenuShell'
import { MenuItem, SubmenuTrigger } from './menuPrimitives'

function flyoutClassName(openLeft: boolean, scrollable = false): string {
  return [
    'absolute top-0 z-10 min-w-44 rounded-lg border border-border bg-bg-primary py-1 shadow-xl',
    openLeft ? 'right-full mr-1' : 'left-full ml-1',
    scrollable ? 'max-h-64 overflow-y-auto' : '',
  ]
    .filter(Boolean)
    .join(' ')
}

interface SharedMenuSectionsProps {
  submenu: TaskMenuSubmenu
  openSub: (next: TaskMenuSubmenu) => void
  openLeft: boolean
  projects: Project[]
  tags: Tag[]
  onSetDue: (daysFromNow: number | null) => void
  onSetPriority: (priority: Priority) => void
  onTagAction: (tagName: string) => void
  tagLabel?: (tagName: string) => string
  isTagActive?: (tagName: string) => boolean
  onMoveToProject: (projectId: string) => void
  isProjectActive?: (projectId: string) => boolean
  isPriorityActive?: (priority: Priority) => boolean
}

export function SharedMenuSections({
  submenu,
  openSub,
  openLeft,
  projects,
  tags,
  onSetDue,
  onSetPriority,
  onTagAction,
  tagLabel = (name) => name,
  isTagActive,
  onMoveToProject,
  isProjectActive,
  isPriorityActive,
}: SharedMenuSectionsProps) {
  const flyout = flyoutClassName(openLeft)
  const flyoutScroll = flyoutClassName(openLeft, true)

  return (
    <>
      <SubmenuTrigger
        label="Date & reminder"
        active={submenu === 'date'}
        onHover={() => openSub('date')}
      >
        {submenu === 'date' && (
          <div className={flyout} onMouseEnter={() => openSub('date')}>
            <MenuItem label="Today" onClick={() => onSetDue(0)} />
            <MenuItem label="Tomorrow" onClick={() => onSetDue(1)} />
            <MenuItem label="Next week" onClick={() => onSetDue(7)} />
            <MenuItem label="Clear date" onClick={() => onSetDue(null)} />
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger
        label="Priority"
        active={submenu === 'priority'}
        onHover={() => openSub('priority')}
      >
        {submenu === 'priority' && (
          <div className={flyout} onMouseEnter={() => openSub('priority')}>
            {([0, 1, 3, 5] as Priority[]).map((p) => (
              <MenuItem
                key={p}
                label={priorityLabels[p]}
                active={isPriorityActive?.(p)}
                onClick={() => onSetPriority(p)}
              />
            ))}
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger label="Tags" active={submenu === 'tags'} onHover={() => openSub('tags')}>
        {submenu === 'tags' && (
          <div className={flyoutScroll} onMouseEnter={() => openSub('tags')}>
            {tags.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-text-muted">No tags yet</p>
            ) : (
              tags.map((tag) => (
                <MenuItem
                  key={tag.id}
                  label={tagLabel(tag.name)}
                  active={isTagActive?.(tag.name)}
                  onClick={() => onTagAction(tag.name)}
                />
              ))
            )}
          </div>
        )}
      </SubmenuTrigger>

      <SubmenuTrigger
        label="Move to list"
        active={submenu === 'move'}
        onHover={() => openSub('move')}
      >
        {submenu === 'move' && (
          <div className={flyoutScroll} onMouseEnter={() => openSub('move')}>
            {projects.map((p) => (
              <MenuItem
                key={p.id}
                label={p.name}
                active={isProjectActive?.(p.id)}
                onClick={() => onMoveToProject(p.id)}
              />
            ))}
          </div>
        )}
      </SubmenuTrigger>
    </>
  )
}
