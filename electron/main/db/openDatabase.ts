import Database from 'better-sqlite3'
import { runMigrations } from './migrations'
import { ProjectFolderRepository } from './repositories/ProjectFolderRepository'
import { ProjectRepository } from './repositories/ProjectRepository'
import { SettingsRepository } from './repositories/SettingsRepository'
import { StickyNoteRepository } from './repositories/StickyNoteRepository'
import { TagRepository } from './repositories/TagRepository'
import { TaskReminderRepository } from './repositories/TaskReminderRepository'
import { TaskRepository } from './repositories/TaskRepository'
import { seedDatabase } from './seed'

export interface Repositories {
  db: Database.Database
  projects: ProjectRepository
  folders: ProjectFolderRepository
  tasks: TaskRepository
  tags: TagRepository
  reminders: TaskReminderRepository
  settings: SettingsRepository
  stickies: StickyNoteRepository
}

export function createRepositories(database: Database.Database): Repositories {
  const settings = new SettingsRepository(database)
  const tags = new TagRepository(database)
  const reminders = new TaskReminderRepository(database)
  const folders = new ProjectFolderRepository(database)
  const projects = new ProjectRepository(database)
  const tasks = new TaskRepository(database, tags, settings, reminders)
  const stickies = new StickyNoteRepository(database)

  return {
    db: database,
    projects,
    folders,
    tasks,
    tags,
    reminders,
    settings,
    stickies,
  }
}

export function openDatabase(
  dbPath: string,
  options?: { verbose?: boolean; seed?: boolean },
): Repositories {
  const database = new Database(dbPath, {
    verbose: options?.verbose ? console.log : undefined,
  })

  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')

  runMigrations(database)

  const repositories = createRepositories(database)
  repositories.projects.ensureInbox()

  if (options?.seed) {
    seedDatabase(repositories)
  }

  return repositories
}

export function closeDatabaseInstance(database: Database.Database): void {
  database.close()
}
