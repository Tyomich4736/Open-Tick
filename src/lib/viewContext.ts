import type { TaskFilter } from '@shared/filters'
import {
  defaultSortForView,
  viewSortScope,
  type SmartListId,
} from '@shared/filters'

export type ViewType =
  | { kind: 'smart'; smart_list: SmartListId; title: string; description: string }
  | { kind: 'project'; projectId: string; title: string; description: string }
  | { kind: 'tag'; tagName: string; title: string; description: string }

export function viewFromPath(pathname: string, projectName?: string): ViewType | null {
  const path = pathname.replace(/^#/, '').replace(/^\//, '')

  const smartViews: Record<string, ViewType> = {
    inbox: {
      kind: 'smart',
      smart_list: 'inbox',
      title: 'Inbox',
      description: 'Tasks in your inbox',
    },
    today: {
      kind: 'smart',
      smart_list: 'today',
      title: 'Today',
      description: 'Tasks due today',
    },
    tomorrow: {
      kind: 'smart',
      smart_list: 'tomorrow',
      title: 'Tomorrow',
      description: 'Tasks due tomorrow',
    },
    week: {
      kind: 'smart',
      smart_list: 'week',
      title: 'Next 7 Days',
      description: 'Upcoming tasks this week',
    },
    overdue: {
      kind: 'smart',
      smart_list: 'overdue',
      title: 'Overdue',
      description: 'Past-due tasks',
    },
    completed: {
      kind: 'smart',
      smart_list: 'completed',
      title: 'Completed',
      description: 'Finished tasks',
    },
  }

  if (path in smartViews) return smartViews[path]

  const projectMatch = path.match(/^project\/(.+)$/)
  if (projectMatch) {
    return {
      kind: 'project',
      projectId: projectMatch[1],
      title: projectName ?? 'List',
      description: 'List tasks',
    }
  }

  const tagMatch = path.match(/^tag\/(.+)$/)
  if (tagMatch) {
    const tagName = decodeURIComponent(tagMatch[1])
    return {
      kind: 'tag',
      tagName,
      title: `#${tagName}`,
      description: 'Tasks with this tag',
    }
  }

  return null
}

export function filterFromView(
  view: ViewType,
  options?: { sort?: TaskFilter['sort']; includeCompleted?: boolean },
): TaskFilter {
  const sort = options?.sort ?? defaultSortForView(view.kind === 'smart' ? view.smart_list : null)
  const includeCompleted = options?.includeCompleted ?? false

  if (view.kind === 'smart') {
    const supportsCompletedToggle =
      view.smart_list === 'inbox' ||
      view.smart_list === 'today' ||
      view.smart_list === 'tomorrow' ||
      view.smart_list === 'week'

    return {
      smart_list: view.smart_list,
      parent_id: null,
      sort,
      ...(supportsCompletedToggle ? { include_completed: includeCompleted } : {}),
    }
  }

  if (view.kind === 'tag') {
    return {
      tag: view.tagName,
      parent_id: null,
      sort,
      include_completed: includeCompleted,
    }
  }

  return {
    project_id: view.projectId,
    parent_id: null,
    sort,
    include_completed: includeCompleted,
  }
}

export function emptyStateForView(view: ViewType): { title: string; description: string } {
  if (view.kind === 'project') {
    return {
      title: `No tasks in ${view.title}`,
      description: 'Add one above to get started',
    }
  }

  if (view.kind === 'tag') {
    return {
      title: `No tasks tagged ${view.title}`,
      description: 'Add a task above or tag an existing one',
    }
  }

  switch (view.smart_list) {
    case 'inbox':
      return { title: 'Inbox zero — nice work!', description: 'New tasks will show up here' }
    case 'today':
      return { title: 'No tasks due today', description: 'Enjoy the free time' }
    case 'tomorrow':
      return { title: 'Nothing due tomorrow', description: 'Plan ahead when you are ready' }
    case 'week':
      return { title: 'Clear week ahead', description: 'No tasks in the next 7 days' }
    case 'overdue':
      return { title: 'No overdue tasks', description: 'You are all caught up' }
    case 'completed':
      return { title: 'No completed tasks yet', description: 'Finished tasks will appear here' }
    default:
      return { title: 'No tasks here', description: 'Add a task above to get started' }
  }
}

export { viewSortScope }
