import { app } from 'electron'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { closeDatabaseInstance, openDatabase, type Repositories } from './openDatabase'

let db: Database.Database | null = null
let repositories: Repositories | null = null

export type { Repositories } from './openDatabase'

export function getDbPath(): string {
  return join(app.getPath('userData'), 'ticktick.db')
}

export function initDatabase(options?: { memory?: boolean; seed?: boolean }): Repositories {
  if (repositories) return repositories

  const dbPath = options?.memory ? ':memory:' : getDbPath()
  repositories = openDatabase(dbPath, {
    verbose: !app.isPackaged,
    seed: options?.seed,
  })
  db = repositories.db
  return repositories
}

export function getRepositories(): Repositories {
  if (!repositories) throw new Error('Database not initialized')
  return repositories
}

export function closeDatabase(): void {
  if (db) {
    closeDatabaseInstance(db)
    db = null
    repositories = null
  }
}
