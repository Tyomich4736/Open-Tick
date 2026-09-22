import type { ReactNode } from 'react'

interface CollapseProps {
  open: boolean
  children: ReactNode
  /** Optional class on the outer grid wrapper */
  className?: string
}

/**
 * Animates height open/closed via CSS grid rows (works with dynamic content).
 * Respects prefers-reduced-motion via Tailwind `motion-reduce:`.
 */
export function Collapse({ open, children, className }: CollapseProps) {
  return (
    <div
      className={[
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
