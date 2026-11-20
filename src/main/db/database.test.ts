import Database from 'better-sqlite3-multiple-ciphers'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  NotScribeCoreDatabaseError,
  SchemaTooNewError,
  getMeta,
  inspectDatabase,
  openDatabase,
  schemaVersion,
} from './database'
import { LATEST_SCHEMA_VERSION } from './migrations'
import { freshDb, tempDir } from './test-helpers'

describe('openDatabase', () => {
  it('creates a new database at the latest schema with safe settings', async () => {
    const { db } = await freshDb()
    expect(schemaVersion(db)).toBe(LATEST_SCHEMA_VERSION)
    expect(db.pragma('journal_mode', { simple: true })).toBe('wal')
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(db.pragma('synchronous', { simple: true })).toBe(2) // FULL
    expect(getMeta(db, 'created_with')).toBe('0.0.0-test')
  })

  it('reports a new file as migrated from 0 and an up-to-date one as not migrated', async () => {
    const file = join(tempDir(), 'a.db')
    const first = await openDatabase(file, { appVersion: '1.0.0' })
    expect(first.migratedFrom).toBe(0)
    first.db.close()
    const beforeMigrate = vi.fn()
    const second = await openDatabase(file, { appVersion: '1.0.1', beforeMigrate })
    expect(second.migratedFrom).toBeNull()
    expect(beforeMigrate).not.toHaveBeenCalled()
    expect(getMeta(second.db, 'created_with')).toBe('1.0.0')
    expect(getMeta(second.db, 'last_opened_with')).toBe('1.0.1')
    second.db.close()
  })

  it('refuses a database from a newer version and leaves it untouched', async () => {
    const file = join(tempDir(), 'newer.db')
    const raw = new Database(file)
    raw.pragma(`user_version = ${LATEST_SCHEMA_VERSION + 1}`)
    raw.close()
    await expect(openDatabase(file, { appVersion: '1.0.0' })).rejects.toBeInstanceOf(SchemaTooNewError)
    const check = new Database(file)
    expect(check.pragma('user_version', { simple: true })).toBe(LATEST_SCHEMA_VERSION + 1)
    check.close()
  })

  it('refuses a SQLite file that belongs to another program', async () => {
    const file = join(tempDir(), 'other.db')
    const raw = new Database(file)
    raw.exec('CREATE TABLE something_else (x)')
    raw.close()
    await expect(openDatabase(file, { appVersion: '1.0.0' })).rejects.toBeInstanceOf(NotScribeCoreDatabaseError)
  })

  it('refuses a file that is not a database at all', async () => {
    const file = join(tempDir(), 'notes.db')
    writeFileSync(file, 'this is just a text file, not SQLite '.repeat(200))
    await expect(openDatabase(file, { appVersion: '1.0.0' })).rejects.toBeInstanceOf(NotScribeCoreDatabaseError)
  })
})

describe('inspectDatabase', () => {
  it('summarises a valid backup', async () => {
    const { db, file } = await freshDb()
    db.prepare("INSERT INTO activities (date, task, created_at, updated_at) VALUES ('2026-01-01', 'x', 'a', 'a')").run()
    db.pragma('wal_checkpoint(TRUNCATE)')
    const summary = inspectDatabase(file)
    expect(summary).toEqual({ schemaVersion: LATEST_SCHEMA_VERSION, activities: 1, createdWith: '0.0.0-test' })
  })

  it('rejects missing, empty and foreign files', () => {
    const dir = tempDir()
    expect(() => inspectDatabase(join(dir, 'missing.db'))).toThrow(NotScribeCoreDatabaseError)
    const empty = join(dir, 'empty.db')
    new Database(empty).close()
    expect(() => inspectDatabase(empty)).toThrow(NotScribeCoreDatabaseError)
    const text = join(dir, 'text.db')
    writeFileSync(text, 'hello '.repeat(1000))
    expect(() => inspectDatabase(text)).toThrow(NotScribeCoreDatabaseError)
  })
})
