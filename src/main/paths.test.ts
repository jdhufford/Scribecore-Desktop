import { chmodSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { tempDir } from './db/test-helpers'
import { detectSyncFolder, isWritableDir, resolveDataLocation } from './paths'

describe('resolveDataLocation', () => {
  const base = { exeDir: '/apps/ScribeCore', appDataDir: '/home/u/AppData/Roaming' }

  it('uses AppData\\ScribeCore when installed', () => {
    const loc = resolveDataLocation({ ...base, isPackaged: true, fileExists: () => false })
    expect(loc).toMatchObject({ dataDir: join(base.appDataDir, 'ScribeCore'), portable: false })
    expect(loc.dbPath).toBe(join(base.appDataDir, 'ScribeCore', 'scribecore.db'))
    expect(loc.backupsDir).toBe(join(base.appDataDir, 'ScribeCore', 'backups'))
  })

  it('uses <exe>\\data when portable.flag is next to the exe', () => {
    const loc = resolveDataLocation({
      ...base,
      isPackaged: true,
      fileExists: (p) => p === join(base.exeDir, 'portable.flag'),
    })
    expect(loc).toMatchObject({ dataDir: join(base.exeDir, 'data'), portable: true })
  })

  it('uses a separate folder in development and ignores portable.flag', () => {
    const loc = resolveDataLocation({ ...base, isPackaged: false, fileExists: () => true })
    expect(loc).toMatchObject({ dataDir: join(base.appDataDir, 'ScribeCore-dev'), portable: false })
  })
})

describe('detectSyncFolder', () => {
  it.each([
    ['C:\\Users\\joe\\OneDrive\\ScribeCore', 'OneDrive'],
    ['C:\\Users\\joe\\OneDrive - Contoso Ltd\\Apps\\ScribeCore', 'OneDrive'],
    ['D:\\Dropbox\\ScribeCore\\data', 'Dropbox'],
    ['C:\\Users\\joe\\Dropbox (Personal)\\x', 'Dropbox'],
    ['G:\\My Drive\\ScribeCore', 'Google Drive'],
    ['C:\\Users\\joe\\iCloudDrive\\ScribeCore', 'iCloud Drive'],
  ])('%s is inside %s', (dir, name) => {
    expect(detectSyncFolder(dir)).toBe(name)
  })

  it('uses the OneDrive environment variables for redirected folders', () => {
    const env = { OneDriveCommercial: 'C:\\Users\\joe\\Work Files' }
    expect(detectSyncFolder('C:\\Users\\joe\\Work Files\\Desktop\\ScribeCore\\data', env)).toBe('OneDrive')
    expect(detectSyncFolder('C:\\Users\\joe\\Work Files Old\\x', env)).toBeNull()
  })

  it.each(['C:\\Users\\joe\\AppData\\Roaming\\ScribeCore', 'E:\\Tools\\ScribeCore\\data', 'C:\\Users\\onedriver\\x'])(
    '%s is not a sync folder',
    (dir) => {
      expect(detectSyncFolder(dir)).toBeNull()
    },
  )
})

describe('isWritableDir', () => {
  it('creates and accepts a writable folder', () => {
    expect(isWritableDir(join(tempDir(), 'new', 'nested'))).toBe(true)
  })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('rejects a read-only folder', () => {
    const dir = join(tempDir(), 'ro')
    mkdirSync(dir)
    chmodSync(dir, 0o500)
    try {
      expect(isWritableDir(dir)).toBe(false)
    } finally {
      chmodSync(dir, 0o700)
    }
  })
})
