import { useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import type { RecurrenceRule } from '@shared/recurrence'
import { recurrenceLabel } from '@shared/recurrence'
import { RecurrenceEditor } from '@/components/tasks/RecurrenceEditor'
import { AnchoredPopover } from '@/components/ui/AnchoredPopover'

interface RecurrenceFieldProps {
  value: RecurrenceRule | null
  onChange: (value: RecurrenceRule | null) => void
  editScope?: 'this' | 'all'
  onEditScopeChange?: (scope: 'this' | 'all') => void
  showEditScope?: boolean
  /** Pill chip trigger matching ProjectPickerChip */
  chip?: boolean
}

const chipTriggerClass =
  'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-bg-primary px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-text-primary'

const fieldTriggerClass =
  'flex w-full items-center gap-2 rounded-lg border border-border bg-bg-primary px-2.5 py-2 text-left text-sm transition-colors hover:border-accent/40'

export function RecurrenceField({
  value,
  onChange,
  editScope = 'all',
  onEditScopeChange,
  showEditScope,
  chip,
}: RecurrenceFieldProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const label = recurrenceLabel(value)

  return (
    <div className={chip ? undefined : 'relative min-w-0 flex-1'}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={[chip ? chipTriggerClass : fieldTriggerClass, open && 'border-accent']
          .filter(Boolean)
          .join(' ')}
      >
        <Repeat className={`shrink-0 ${chip ? 'size-3 opacity-70' : 'size-3.5 text-text-muted'}`} />
        <span
          className={`min-w-0 truncate ${chip ? 'max-w-[10rem]' : 'flex-1'} ${
            value ? 'text-text-primary' : 'text-text-muted'
          }`}
        >
          {label}
        </span>
      </button>

      <AnchoredPopover
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        width={260}
        className="max-h-[60vh] w-[260px] overflow-y-auto rounded-xl border border-border bg-bg-primary p-3 shadow-lg"
      >
        <RecurrenceEditor value={value} onChange={onChange} />
        {showEditScope && onEditScopeChange && (
          <label className="mt-3 block text-xs text-text-muted">
            Apply edits to
            <select
              value={editScope}
              onChange={(e) => onEditScopeChange(e.target.value as 'this' | 'all')}
              className="mt-1 w-full rounded-lg border border-border bg-bg-sidebar px-3 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="all">This and all future</option>
              <option value="this">This occurrence only</option>
            </select>
          </label>
        )}
      </AnchoredPopover>
    </div>
  )
}
