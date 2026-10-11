import type { ReactNode } from 'react'

export function Divider() {
  return <div className="my-1 border-t border-border" />
}

export function SubmenuTrigger({
  label,
  active,
  onHover,
  children,
}: {
  label: string
  active?: boolean
  onHover: () => void
  children?: ReactNode
}) {
  return (
    <div className="relative" onMouseEnter={onHover}>
      <div
        className={[
          'flex w-full cursor-default items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-text-primary',
          active ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5',
        ].join(' ')}
      >
        <span>{label}</span>
        <span className="text-text-muted">›</span>
      </div>
      {children}
    </div>
  )
}

export function MenuItem({
  label,
  onClick,
  onHover,
  danger,
  active,
  disabled,
}: {
  label: string
  onClick: () => void
  onHover?: () => void
  danger?: boolean
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onHover}
      className={[
        'flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm',
        disabled
          ? 'cursor-not-allowed text-text-muted opacity-40'
          : 'hover:bg-black/5 dark:hover:bg-white/5',
        !disabled && danger ? 'text-priority-high' : '',
        !disabled && !danger && !active ? 'text-text-primary' : '',
        !disabled && active ? 'font-medium text-accent' : '',
      ].join(' ')}
    >
      <span>{label}</span>
      {active && <span className="text-accent">✓</span>}
    </button>
  )
}
