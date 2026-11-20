import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { openDatabase, type DB } from './database'

const dirs: string[] = []
const dbs: DB[] = []

/** A fresh temp folder, removed after the test. */
export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scribecore-test-'))
  dirs.push(dir)
  return dir
}

/** A fresh database on disk (WAL needs a real file), closed after the test. */
export async function freshDb(file = join(tempDir(), 'scribecore.db')): Promise<{ db: DB; file: string }> {
  const { db } = await openDatabase(file, { appVersion: '0.0.0-test' })
  dbs.push(db)
  return { db, file }
}

afterEach(() => {
  for (const db of dbs.splice(0)) {
    if (db.open) db.close()
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
