import Database from 'better-sqlite3-multiple-ciphers'
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { inspectDatabase, type DatabaseSummary, type DB } from './database'

// Backups (SPEC 5.6). Daily copies: scribecore-YYYY-MM-DD.db. Safety copies made
// before a migration or restore: scribecore-YYYY-MM-DD-<reason>.db.
//
// NOTE for milestone 6 (encryption): db.backup() must be re-verified to produce
// an encrypted copy when the source database is encrypted.

export const KEEP_DAILY = 7
export const KEEP_WEEKLY = 4
export const KEEP_SAFETY = 5

const DAILY = /^scribecore-(\d{4}-\d{2}-\d{2})\.db$/
const SAFETY = /^scribecore-(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)\.db$/

/** Local calendar date as YYYY-MM-DD. */
export function localDateStamp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** ISO-8601 week key (e.g. "2026-W47") for a YYYY-MM-DD date. */
export function isoWeekKey(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d))
  const dayNum = dt.getUTCDay() || 7 // Monday = 1 ... Sunday = 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum) // Thursday of this week decides the year
  const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((dt.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/**
 * Which backup files to delete: keep the newest KEEP_DAILY daily backups, then the
 * newest backup of each of the next KEEP_WEEKLY weeks, and the newest KEEP_SAFETY
 * safety copies. Files that are not ScribeCore backups are never touched.
 */
export function selectBackupsToDelete(files: string[]): string[] {
  const daily = files
    .map((f) => ({ f, m: DAILY.exec(f) }))
    .filter((x): x is { f: string; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => b.m[1]!.localeCompare(a.m[1]!))

  const keep = new Set(daily.slice(0, KEEP_DAILY).map((x) => x.f))
  const keptWeeks = new Set(daily.slice(0, KEEP_DAILY).map((x) => isoWeekKey(x.m[1]!)))
  const weeksAdded = new Set<string>()
  for (const x of daily.slice(KEEP_DAILY)) {
    const week = isoWeekKey(x.m[1]!)
    if (keptWeeks.has(week) || weeksAdded.has(week)) continue
    if (weeksAdded.size >= KEEP_WEEKLY) break
    weeksAdded.add(week)
    keep.add(x.f)
  }

  const safety = files
    .map((f) => ({ f, m: SAFETY.exec(f) }))
    .filter((x): x is { f: string; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => b.f.localeCompare(a.f))
  for (const x of safety.slice(0, KEEP_SAFETY)) keep.add(x.f)

  return [...daily, ...safety].map((x) => x.f).filter((f) => !keep.has(f))
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Write a consistent copy of an open database to `dest` (via a temp file, then rename). */
export async function backupTo(db: DB, dest: string): Promise<void> {
  const tmp = `${dest}.partial`
  await rm(tmp, { force: true })
  await db.backup(tmp)
  // The copy inherits WAL mode; switch it to a plain single-file database so a
  // backup never needs -wal/-shm side files (and can be read from read-only media).
  const copy = new Database(tmp)
  try {
    copy.pragma('journal_mode = DELETE')
  } finally {
    copy.close()
  }
  await rename(tmp, dest)
}

export async function pruneBackups(dir: string): Promise<string[]> {
  const files = await readdir(dir)
  const doomed = selectBackupsToDelete(files)
  for (const f of doomed) await rm(join(dir, f), { force: true })
  return doomed
}

/** Make today's backup if there isn't one yet, then prune. Returns the new file, or null. */
export async function runDailyBackup(db: DB, dir: string, now = new Date()): Promise<string | null> {
  await mkdir(dir, { recursive: true })
  const dest = join(dir, `scribecore-${localDateStamp(now)}.db`)
  if (await exists(dest)) return null
  await backupTo(db, dest)
  await pruneBackups(dir)
  return dest
}

/** A safety copy before a risky operation, e.g. reason "pre-v2" or "pre-restore". */
export async function safetyBackup(db: DB, dir: string, reason: string, now = new Date()): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(reason)) throw new Error(`Invalid backup reason: ${reason}`)
  await mkdir(dir, { recursive: true })
  let dest = join(dir, `scribecore-${localDateStamp(now)}-${reason}.db`)
  for (let n = 2; await exists(dest); n++) {
    dest = join(dir, `scribecore-${localDateStamp(now)}-${reason}-${n}.db`)
  }
  await backupTo(db, dest)
  return dest
}

/**
 * Replace the database at `dbPath` with `source`. The caller passes the open
 * database; it is backed up ("pre-restore"), closed, and must be reopened by the
 * caller afterwards. The source is checked before anything is changed.
 */
export async function restoreFromBackup(options: {
  db: DB
  dbPath: string
  source: string
  backupsDir: string
}): Promise<{ summary: DatabaseSummary; safetyCopy: string }> {
  const { db, dbPath, source, backupsDir } = options
  if (resolve(source).toLowerCase() === resolve(dbPath).toLowerCase()) {
    throw new Error('Cannot restore the live data file onto itself.')
  }
  const summary = inspectDatabase(source)
  const safetyCopy = await safetyBackup(db, backupsDir, 'pre-restore')
  db.close()

  const tmp = `${dbPath}.restoring`
  await copyFile(source, tmp)
  await rm(`${dbPath}-wal`, { force: true })
  await rm(`${dbPath}-shm`, { force: true })
  await rename(tmp, dbPath)
  return { summary, safetyCopy }
}
