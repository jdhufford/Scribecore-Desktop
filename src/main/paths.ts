import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Where ScribeCore keeps its files (SPEC 8).

export const PORTABLE_FLAG = 'portable.flag'

export interface DataLocation {
  dataDir: string
  dbPath: string
  backupsDir: string
  logsDir: string
  /** Electron/Chromium's own files (cache, local storage), kept out of the way. */
  chromiumDir: string
  portable: boolean
}

export function locationFor(dataDir: string, portable: boolean): DataLocation {
  return {
    dataDir,
    dbPath: join(dataDir, 'scribecore.db'),
    backupsDir: join(dataDir, 'backups'),
    logsDir: join(dataDir, 'logs'),
    chromiumDir: join(dataDir, 'chromium'),
    portable,
  }
}

/**
 * Portable build: a portable.flag file next to the exe puts data in <exe>\data.
 * Installed build: %APPDATA%\ScribeCore. Development: %APPDATA%\ScribeCore-dev,
 * so a dev run never touches real data.
 */
export function resolveDataLocation(options: {
  exeDir: string
  appDataDir: string
  isPackaged: boolean
  fileExists: (path: string) => boolean
}): DataLocation {
  const { exeDir, appDataDir, isPackaged, fileExists } = options
  if (isPackaged && fileExists(join(exeDir, PORTABLE_FLAG))) {
    return locationFor(join(exeDir, 'data'), true)
  }
  return locationFor(join(appDataDir, isPackaged ? 'ScribeCore' : 'ScribeCore-dev'), false)
}

const SYNC_FOLDER_PATTERNS: [RegExp, string][] = [
  [/(^|\/)onedrive( - [^/]+)?(\/|$)/i, 'OneDrive'],
  [/(^|\/)dropbox( \([^/]+\))?(\/|$)/i, 'Dropbox'],
  [/(^|\/)google ?drive(\/|$)/i, 'Google Drive'],
  [/(^|\/)my drive(\/|$)/i, 'Google Drive'],
  [/(^|\/)icloud ?drive(\/|$)/i, 'iCloud Drive'],
  [/(^|\/)box(\/|$)/i, 'Box'],
]

/**
 * Name of the cloud-sync service whose folder contains `dir`, or null.
 * A live SQLite file in a synced folder can be corrupted by the sync client.
 */
export function detectSyncFolder(dir: string, env: Record<string, string | undefined> = {}): string | null {
  const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  const target = norm(dir)
  for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) {
    const root = env[key]
    if (root && (target === norm(root) || target.startsWith(`${norm(root)}/`))) return 'OneDrive'
  }
  for (const [pattern, name] of SYNC_FOLDER_PATTERNS) {
    if (pattern.test(target)) return name
  }
  return null
}

/** True if we can create the folder and write a file in it. */
export function isWritableDir(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true })
    const probe = join(dir, `.write-test-${process.pid}`)
    writeFileSync(probe, '')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}
