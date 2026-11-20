import Database from 'better-sqlite3-multiple-ciphers'
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations'

export type DB = Database.Database

/** The file was written by a newer ScribeCore; opening it could damage it. */
export class SchemaTooNewError extends Error {
  constructor(
    readonly found: number,
    readonly supported: number,
  ) {
    super(
      `This data file uses schema version ${found}, but this copy of ScribeCore only ` +
        `understands up to version ${supported}. Install the latest version of ScribeCore.`,
    )
    this.name = 'SchemaTooNewError'
  }
}

/** The file is not a ScribeCore database (or is damaged). */
export class NotScribeCoreDatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotScribeCoreDatabaseError'
  }
}

export interface OpenOptions {
  appVersion: string
  /**
   * Called before migrating an existing database to a newer schema, so a copy
   * of the old file exists if the migration goes wrong.
   */
  beforeMigrate?: (db: DB, fromVersion: number) => Promise<void>
}

export interface OpenResult {
  db: DB
  /** Schema version before opening (0 = new file), or null if no migration ran. */
  migratedFrom: number | null
}

function applyPragmas(db: DB): void {
  db.pragma('journal_mode = WAL')
  // FULL: a power cut must never lose an entry the user saw as saved.
  db.pragma('synchronous = FULL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
}

export function schemaVersion(db: DB): number {
  return db.pragma('user_version', { simple: true }) as number
}

function setMeta(db: DB, key: string, value: string): void {
  db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
    key,
    value,
  )
}

export function getMeta(db: DB, key: string): string | null {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

/** Bring the schema up to date. Returns the starting version, or null if none ran. */
export async function migrate(db: DB, options: OpenOptions): Promise<number | null> {
  const current = schemaVersion(db)
  if (current > LATEST_SCHEMA_VERSION) throw new SchemaTooNewError(current, LATEST_SCHEMA_VERSION)

  if (current === 0) {
    // A brand-new file must be empty; refuse to build on top of someone else's tables.
    const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get() as { n: number }
    if (tables.n > 0) {
      throw new NotScribeCoreDatabaseError('This file is a SQLite database, but not a ScribeCore one.')
    }
  }

  if (current === LATEST_SCHEMA_VERSION) {
    setMeta(db, 'last_opened_with', options.appVersion)
    return null
  }

  if (current > 0 && options.beforeMigrate) await options.beforeMigrate(db, current)

  const run = db.transaction(() => {
    for (const m of MIGRATIONS) {
      if (m.version <= current) continue
      db.exec(m.sql)
      db.pragma(`user_version = ${m.version}`)
    }
    if (current === 0) setMeta(db, 'created_with', options.appVersion)
    setMeta(db, 'last_opened_with', options.appVersion)
  })
  run()
  return current
}

/** Open (creating if needed) and migrate a ScribeCore database. */
export async function openDatabase(file: string, options: OpenOptions): Promise<OpenResult> {
  let db: DB
  try {
    db = new Database(file)
    applyPragmas(db)
  } catch (err) {
    if (err instanceof Error && /not a database|file is encrypted/i.test(err.message)) {
      throw new NotScribeCoreDatabaseError('This file is not a ScribeCore data file, or it is damaged.')
    }
    throw err
  }
  try {
    const migratedFrom = await migrate(db, options)
    return { db, migratedFrom }
  } catch (err) {
    db.close()
    throw err
  }
}

export interface DatabaseSummary {
  schemaVersion: number
  activities: number
  createdWith: string | null
}

/**
 * Open a file read-only and check it is a ScribeCore database this version can
 * use. Used before restoring a backup.
 */
export function inspectDatabase(file: string): DatabaseSummary {
  let db: DB
  try {
    db = new Database(file, { readonly: true, fileMustExist: true })
  } catch (err) {
    throw new NotScribeCoreDatabaseError(`Cannot open ${file}: ${(err as Error).message}`)
  }
  try {
    let version: number
    try {
      version = schemaVersion(db)
      const check = db.pragma('quick_check', { simple: true })
      if (check !== 'ok') throw new NotScribeCoreDatabaseError('The file failed an integrity check.')
    } catch (err) {
      if (err instanceof NotScribeCoreDatabaseError) throw err
      throw new NotScribeCoreDatabaseError('This file is not a ScribeCore data file, or it is damaged.')
    }
    if (version === 0) throw new NotScribeCoreDatabaseError('This file is not a ScribeCore data file.')
    if (version > LATEST_SCHEMA_VERSION) throw new SchemaTooNewError(version, LATEST_SCHEMA_VERSION)
    const activities = (db.prepare('SELECT count(*) AS n FROM activities').get() as { n: number }).n
    return { schemaVersion: version, activities, createdWith: getMeta(db, 'created_with') }
  } finally {
    db.close()
  }
}
