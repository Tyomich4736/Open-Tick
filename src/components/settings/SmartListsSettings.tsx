import { useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'
import {
  SMART_LIST_LABELS,
  moveSmartList,
  setSmartListEnabled,
  type SmartListId,
} from '@shared/smartListSettings'
import { useSmartListSettings } from '@/hooks/useSmartListSettings'

export function SmartListsSettings() {
  const { config, setConfig } = useSmartListSettings()
  const dragFrom = useRef<number | null>(null)
  const allowDrag = useRef(false)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function onDragStart(e: React.DragEvent, index: number) {
    if (!allowDrag.current) {
      e.preventDefault()
      return
    }
    dragFrom.current = index
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
    if (from == null || toIndex == null || from === toIndex) return
    setConfig(moveSmartList(config, from, toIndex))
  }

  function toggle(id: SmartListId, enabled: boolean) {
    setConfig(setSmartListEnabled(config, id, enabled))
  }

  return (
    <section className="max-w-lg space-y-4">
      <div>
        <h3 className="font-medium text-text-primary">Smart lists</h3>
        <p className="mt-1 text-sm text-text-muted">
          Choose which lists appear in the sidebar and drag to reorder them
        </p>
      </div>

      <ul className="overflow-hidden rounded-lg border border-border">
        {config.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => onDragOver(e, index)}
            onDrop={() => finishDrag(index)}
            onDragEnd={() => finishDrag()}
            className={[
              'flex items-center gap-2 border-b border-border bg-bg-primary px-2 py-2 last:border-b-0',
              overIndex === index ? 'bg-accent/5' : '',
            ].join(' ')}
          >
            <button
              type="button"
              className="cursor-grab touch-none rounded p-1 text-text-muted hover:bg-black/5 hover:text-text-primary active:cursor-grabbing dark:hover:bg-white/5"
              aria-label={`Drag to reorder ${SMART_LIST_LABELS[item.id]}`}
              title="Drag to reorder"
              onMouseDown={() => {
                allowDrag.current = true
              }}
              onMouseUp={() => {
                allowDrag.current = false
              }}
            >
              <GripVertical className="size-4" aria-hidden />
            </button>

            <span className="min-w-0 flex-1 text-sm text-text-primary">
              {SMART_LIST_LABELS[item.id]}
            </span>

            <label className="flex cursor-pointer items-center gap-2 pl-2">
              <span className="sr-only">
                {item.enabled ? 'Disable' : 'Enable'} {SMART_LIST_LABELS[item.id]}
              </span>
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={(e) => toggle(item.id, e.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
