import { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { TaskListItem } from '@shared/entities'
import { formatDueRange, isOverdue } from '@/lib/formatDueDate'
import { priorityTextColor } from '@/lib/priority'
import { resolveProjectColor } from '@/lib/theme'
import { useTimeFormat } from '@/hooks/useTimeFormat'
import { useListDensity } from '@/hooks/useLayoutSettings'

interface TaskRowProps {
  task: TaskListItem
  selected: boolean
  depth?: number
  draggable?: boolean
  dragging?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  expanded?: boolean
  onToggleExpand?: () => void
  onSelect: (e: React.MouseEvent | React.KeyboardEvent) => void
  onToggleComplete: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}

export const TaskRow = memo(function TaskRow({
  task,
  selected,
  depth = 0,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  expanded,
  onToggleExpand,
  onSelect,
  onToggleComplete,
  onContextMenu,
}: TaskRowProps) {
  const { timeFormat } = useTimeFormat()
  const { density } = useListDensity()
  const dueLabel = formatDueRange(
    {
      due_date: task.due_date,
      start_date: task.start_date,
      is_all_day: task.is_all_day,
    },
    timeFormat,
  )
  const overdue = task.status === 'pending' && isOverdue(task.due_date, task.is_all_day)
  const completed = task.status === 'completed'
  const hasSubtasks = task.subtask_count > 0
  const compact = density === 'compact'
  const padY = compact ? 'py-1.5' : 'py-2.5'
  const titleColor = completed ? undefined : priorityTextColor(task.priority)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(e)
        }
      }}
      className={[
        'group relative flex items-center gap-2 border-b border-border px-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
        padY,
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        selected ? 'border-l-2 border-l-accent bg-accent/5' : 'border-l-2 border-l-transparent',
        dragging ? 'opacity-40' : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]',
        completed ? 'task-row-completed' : '',
      ].join(' ')}
      style={{ paddingLeft: `${16 + depth * 20}px` }}
    >
      {hasSubtasks && onToggleExpand ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
        >
          <ChevronRight
            className={[
              'size-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
              expanded ? 'rotate-90' : 'rotate-0',
            ].join(' ')}
          />
        </button>
      ) : (
        <span className="size-7 shrink-0" />
      )}

      <input
        type="checkbox"
        checked={completed}
        onChange={onToggleComplete}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Mark complete: ${task.title}`}
        className="task-checkbox size-4 shrink-0 cursor-pointer transition-transform duration-150 checked:scale-110"
      />

      <span
        className="h-4 w-0.5 shrink-0 rounded-full"
        style={{
          backgroundColor: task.project_color || 'transparent',
        }}
        title={task.project_color ? task.project_name : undefined}
      />

      <span
        className={[
          'min-w-0 flex-1 truncate text-left text-[15px] font-medium leading-snug',
          completed ? 'text-text-muted line-through' : titleColor ? '' : 'text-text-primary',
        ].join(' ')}
        style={titleColor ? { color: titleColor } : undefined}
      >
        {task.title}
      </span>

      {task.tags.length > 0 && (
        <div className="flex min-w-0 shrink gap-1 overflow-hidden">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className={[
                'truncate rounded bg-accent/10 px-1.5 py-0.5 text-xs text-accent',
                completed ? 'opacity-60' : '',
              ].join(' ')}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {hasSubtasks && (
        <span className="shrink-0 text-xs text-text-muted">
          {task.completed_subtask_count}/{task.subtask_count}
        </span>
      )}

      {dueLabel && (
        <span
          className={[
            'ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs',
            overdue
              ? 'bg-red-50 font-medium text-priority-high dark:bg-red-950/40'
              : 'bg-black/5 text-text-muted dark:bg-white/5',
          ].join(' ')}
        >
          {dueLabel}
        </span>
      )}
    </div>
  )
})
