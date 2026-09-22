import type { Priority } from '@shared/entities'

export const priorityColors: Record<Priority, string> = {
  0: 'transparent',
  1: '#4772FA',
  3: '#FFAF38',
  5: '#FE7777',
}

export function priorityColor(priority: Priority): string {
  return priorityColors[priority]
}

/** Title / label text color for priority (none → inherit / primary). */
export function priorityTextColor(priority: Priority): string | undefined {
  if (priority === 0) return undefined
  return priorityColors[priority]
}

export const priorityLabels: Record<Priority, string> = {
  0: 'None',
  1: 'Low',
  3: 'Medium',
  5: 'High',
}

export function priorityLabel(priority: Priority): string {
  return priorityLabels[priority]
}
