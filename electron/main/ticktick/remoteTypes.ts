/** Remote DTO types for TickTick Open API (inbound / Phase 13). */

export interface RemoteProjectGroup {
  id: string
  name: string
  sortOrder?: number
}

export interface RemoteProject {
  id: string
  name: string
  color?: string
  viewMode?: string
  kind?: string
  groupId?: string | null
  sortOrder?: number
  modifiedTime?: string
  closed?: boolean
}

export interface RemoteTask {
  id: string
  projectId: string
  title?: string
  content?: string
  desc?: string
  priority?: number
  status?: number
  dueDate?: string | null
  startDate?: string | null
  isAllDay?: boolean
  timeZone?: string | null
  parentId?: string | null
  /** TickTick section / kanban column id */
  columnId?: string | null
  tags?: string[]
  /** iCal TRIGGER strings, e.g. TRIGGER:-PT15M */
  reminders?: string[] | null
  /** RRULE string, often prefixed with RRULE: */
  repeatFlag?: string | null
  sortOrder?: number
  modifiedTime?: string
  completedTime?: string | null
  kind?: string
}

/** List section (TickTick calls these columns). */
export interface RemoteColumn {
  id: string
  projectId?: string
  name?: string
  sortOrder?: number
}

export interface RemoteProjectData {
  project?: RemoteProject
  tasks?: RemoteTask[]
  columns?: RemoteColumn[]
}
