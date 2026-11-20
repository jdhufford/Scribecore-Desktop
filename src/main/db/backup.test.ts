import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isoWeekKey,
  localDateStamp,
  restoreFromBackup,
  runDailyBackup,
  safetyBackup,
  selectBackupsToDelete,
} from './backup'
import { inspectDatabase, openDatabase } from './database'
import { Repository } from './repository'
import { freshDb, tempDir } from './test-helpers'

function daily(date: string): string {
  return `scribecore-${date}.db`
}

describe('isoWeekKey', () => {
  it.each([
    ['2026-11-20', '2026-W47'],
    ['2026-01-01', '2026-W01'], // Thursday
    ['2027-01-01', '2026-W53'], // Friday belongs to the last week of 2026
    ['2024-12-30', '2025-W01'], // Monday belongs to week 1 of 2025
  ])('%s is %s', (date, week) => {
    expect(isoWeekKey(date)).toBe(week)
  })
})

describe('selectBackupsToDelete', () => {
  it('keeps 7 daily backups and the newest of each of the 4 weeks before them', () => {
    const files: string[] = []
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.UTC(2026, 10, 20) - i * 86_400_000)
      files.push(daily(d.toISOString().slice(0, 10)))
    }
    const doomed = new Set(selectBackupsToDelete(files))
    const kept = files.filter((f) => !doomed.has(f))
    expect(kept).toEqual([
      // 7 most recent days (Sat 2026-11-14 .. Fri 2026-11-20; W46 and W47)
      daily('2026-11-20'),
      daily('2026-11-19'),
      daily('2026-11-18'),
      daily('2026-11-17'),
      daily('2026-11-16'),
      daily('2026-11-15'),
      daily('2026-11-14'),
      // newest of the next 4 weeks: W45, W44, W43, W42 (Sundays)
      daily('2026-11-08'),
      daily('2026-11-01'),
      daily('2026-10-25'),
      daily('2026-10-18'),
    ])
  })

  it('keeps the 5 newest safety copies and ignores unrelated files', () => {
    const safety = [
      'scribecore-2026-11-01-pre-restore.db',
      'scribecore-2026-11-02-pre-restore.db',
      'scribecore-2026-11-03-pre-v1-upgrade.db',
      'scribecore-2026-11-04-pre-restore.db',
      'scribecore-2026-11-05-pre-restore.db',
      'scribecore-2026-11-06-pre-restore.db',
    ]
    const doomed = selectBackupsToDelete([...safety, 'notes.txt', 'scribecore.db', 'my-copy.db'])
    expect(doomed).toEqual(['scribecore-2026-11-01-pre-restore.db'])
  })
})

describe('runDailyBackup', () => {
  it('writes one backup per local day, readable as a ScribeCore database', async () => {
    const { db } = await freshDb()
    new Repository(db).create({ date: '2026-11-20', task: 'backed up' })
    const dir = join(tempDir(), 'backups')
    const now = new Date(2026, 10, 20, 9, 30)
    const first = await runDailyBackup(db, dir, now)
    expect(first).toBe(join(dir, `scribecore-${localDateStamp(now)}.db`))
    expect(await runDailyBackup(db, dir, now)).toBeNull()
    expect(inspectDatabase(first!).activities).toBe(1)
    expect(readdirSync(dir)).toEqual(['scribecore-2026-11-20.db'])
  })

  it('prunes old backups after writing', async () => {
    const { db } = await freshDb()
    const dir = tempDir()
    for (let day = 1; day <= 12; day++) writeFileSync(join(dir, daily(`2026-11-${String(day).padStart(2, '0')}`)), '')
    await runDailyBackup(db, dir, new Date(2026, 10, 20))
    const files = readdirSync(dir).sort()
    expect(files).toContain('scribecore-2026-11-20.db')
    expect(files.length).toBeLessThanOrEqual(7 + 4)
  })
})

describe('safetyBackup', () => {
  it('never overwrites an earlier safety copy from the same day', async () => {
    const { db } = await freshDb()
    const dir = tempDir()
    const now = new Date(2026, 10, 20)
    const a = await safetyBackup(db, dir, 'pre-restore', now)
    const b = await safetyBackup(db, dir, 'pre-restore', now)
    expect(a).not.toBe(b)
    expect(b.endsWith('pre-restore-2.db')).toBe(true)
    await expect(safetyBackup(db, dir, '../escape', now)).rejects.toThrow()
  })
})

describe('restoreFromBackup', () => {
  it('replaces the live database, keeping a safety copy of what was there', async () => {
    const { db, file } = await freshDb()
    const repo = new Repository(db)
    repo.create({ date: '2026-11-01', task: 'in backup' })
    const backupsDir = join(tempDir(), 'backups')
    const backup = await runDailyBackup(db, backupsDir, new Date(2026, 10, 1))
    repo.create({ date: '2026-11-20', task: 'added after backup' })

    const { summary, safetyCopy } = await restoreFromBackup({ db, dbPath: file, source: backup!, backupsDir })
    expect(summary.activities).toBe(1)
    expect(db.open).toBe(false)
    expect(inspectDatabase(safetyCopy).activities).toBe(2)

    const reopened = await openDatabase(file, { appVersion: 'test' })
    expect(new Repository(reopened.db).list().map((a) => a.task)).toEqual(['in backup'])
    reopened.db.close()
  })

  it('refuses a bad file before touching anything', async () => {
    const { db, file } = await freshDb()
    new Repository(db).create({ date: '2026-11-20', task: 'precious' })
    const dir = tempDir()
    const bad = join(dir, 'bad.db')
    writeFileSync(bad, 'not a database '.repeat(500))
    await expect(restoreFromBackup({ db, dbPath: file, source: bad, backupsDir: dir })).rejects.toThrow()
    expect(db.open).toBe(true)
    expect(new Repository(db).list()).toHaveLength(1)
    expect(existsSync(join(dir, 'backups'))).toBe(false)
    await expect(restoreFromBackup({ db, dbPath: file, source: file, backupsDir: dir })).rejects.toThrow(/itself/)
  })
})
