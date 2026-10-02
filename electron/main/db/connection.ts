import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { dirname, join } from 'path'
import type Database from 'better-sqlite3'
import { closeDatabaseInstance, openDatabase, type Repositories } from './openDatabase'

let db: Database.Database | null = null
let repositories: Repositories | null = null

export type { Repositories } from './openDatabase'

const DB_FILE = 'opentick.db'
const LEGACY_DB_FILE = 'ticktick.db'
const LEGACY_USER_DATA_NAMES = ['TickTick Clone', 'ticktick-clone']

function migrateSidecar(fromBase: string, toBase: string, suffix: string): void {
  const from = `${fromBase}${suffix}`
  const to = `${toBase}${suffix}`
  if (!existsSync(from) || existsSync(to)) return
  try {
    renameSync(from, to)
  } catch {
    try {
      copyFileSync(from, to)
    } catch {
      /* ignore */
    }
  }
}

/** Move DB from TickTick Clone paths / filename into the Open Tick userData dir. */
export function migrateLegacyDatabase(): void {
  const userData = app.getPath('userData')
  mkdirSync(userData, { recursive: true })
  const target = join(userData, DB_FILE)
  if (existsSync(target)) return

  const sameDirLegacy = join(userData, LEGACY_DB_FILE)
  if (existsSync(sameDirLegacy)) {
    renameSync(sameDirLegacy, target)
    migrateSidecar(sameDirLegacy, target, '-wal')
    migrateSidecar(sameDirLegacy, target, '-shm')
    return
  }

  const parent = dirname(userData)
  for (const name of LEGACY_USER_DATA_NAMES) {
    const legacyDb = join(parent, name, LEGACY_DB_FILE)
    if (!existsSync(legacyDb)) continue
    copyFileSync(legacyDb, target)
    migrateSidecar(legacyDb, target, '-wal')
    migrateSidecar(legacyDb, target, '-shm')
    return
  }
}

export function getDbPath(): string {
  return join(app.getPath('userData'), DB_FILE)
}

export function initDatabase(options?: { memory?: boolean; seed?: boolean }): Repositories {
  if (repositories) return repositories

  if (!options?.memory) {
    migrateLegacyDatabase()
  }

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
