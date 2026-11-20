import { app, BrowserWindow, dialog, ipcMain, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { IPC, type AppInfo } from '../shared/types'
import { runDailyBackup, safetyBackup } from './db/backup'
import {
  NotScribeCoreDatabaseError,
  SchemaTooNewError,
  openDatabase,
  schemaVersion,
  type DB,
} from './db/database'
import { Repository } from './db/repository'
import { registerDataIpc } from './ipc'
import { log, initLog } from './log'
import {
  detectSyncFolder,
  isWritableDir,
  locationFor,
  resolveDataLocation,
  type DataLocation,
} from './paths'
import { RELEASES_URL, isAllowedExternalUrl, isAllowedRequest } from './security'

const APP_ID = 'io.github.jdhufford.scribecore'
const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

// ---- Data location: decided before 'ready', because Chromium's own files go there too.
let location: DataLocation = resolveDataLocation({
  exeDir: dirname(app.getPath('exe')),
  appDataDir: app.getPath('appData'),
  isPackaged: app.isPackaged,
  fileExists: existsSync,
})
const portableUnwritable = location.portable && !isWritableDir(location.dataDir)
const appDataLocation = locationFor(join(app.getPath('appData'), 'ScribeCore'), false)
// A read-only portable folder (e.g. a locked USB stick) cannot hold Chromium's files either.
app.setPath('userData', (portableUnwritable ? appDataLocation : location).chromiumDir)

let mainWindow: BrowserWindow | null = null
let db: DB | null = null
let repository: Repository | null = null

function repo(): Repository {
  if (!repository) throw new Error('Database is not open')
  return repository
}

function openExternal(url: string): void {
  if (isAllowedExternalUrl(url)) void shell.openExternal(url)
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'ScribeCore',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // No popups and no navigating away from the app. Allowed links go to the
  // user's default browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) {
      event.preventDefault()
      openExternal(url)
    }
  })

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function lockDownSession(): void {
  const ses = session.defaultSession
  // Local-only app: refuse every request that is not a bundled file
  // (or, in development, the dev server).
  ses.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRequest(details.url, devServerUrl) })
  })
  // No camera, microphone, notifications, geolocation, etc.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}

function registerAppIpc(): void {
  ipcMain.handle(
    IPC.appInfo,
    (): AppInfo => ({
      name: app.getName(),
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      platform: process.platform,
      arch: process.arch,
      dataDir: location.dataDir,
      portable: location.portable,
      syncFolder: detectSyncFolder(location.dataDir, process.env),
      schemaVersion: db ? schemaVersion(db) : 0,
    }),
  )
  ipcMain.handle(IPC.openReleases, () => shell.openExternal(RELEASES_URL))
}

function fatal(title: string, message: string): false {
  log.error(`${title}: ${message}`)
  const buttons = ['Quit', 'Open data folder']
  const choice = dialog.showMessageBoxSync({ type: 'error', title: 'ScribeCore', message: title, detail: message, buttons })
  if (choice === 1) void shell.openPath(location.dataDir)
  return false
}

/** Make sure the data folder is usable. Returns false if the app should quit. */
function chooseDataFolder(): boolean {
  if (portableUnwritable) {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'ScribeCore',
      message: 'ScribeCore cannot save data next to the program.',
      detail:
        `The folder ${location.dataDir} is read-only. This happens when the portable copy is ` +
        `on a write-protected drive or in a protected folder such as Program Files.\n\n` +
        `Use your user profile (${appDataLocation.dataDir}) instead?`,
      buttons: ['Use my user profile', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    })
    if (choice !== 0) return false
    location = appDataLocation
  }
  if (!isWritableDir(location.dataDir)) {
    return fatal('ScribeCore cannot write to its data folder.', location.dataDir)
  }
  return true
}

async function startDatabase(): Promise<boolean> {
  initLog(location.logsDir)
  log.info(`ScribeCore ${app.getVersion()} starting; data folder ${location.dataDir}${location.portable ? ' (portable)' : ''}`)
  const sync = detectSyncFolder(location.dataDir, process.env)
  if (sync) log.warn(`Data folder is inside ${sync}; sync clients can corrupt a live database`)

  try {
    const result = await openDatabase(location.dbPath, {
      appVersion: app.getVersion(),
      beforeMigrate: async (openDb, fromVersion) => {
        const copy = await safetyBackup(openDb, location.backupsDir, `pre-v${fromVersion}-upgrade`)
        log.info(`Saved ${copy} before upgrading the schema from version ${fromVersion}`)
      },
    })
    db = result.db
    repository = new Repository(db)
    if (result.migratedFrom !== null) {
      log.info(result.migratedFrom === 0 ? `New data file created (schema version ${schemaVersion(db)})` : `Schema upgraded from version ${result.migratedFrom} to ${schemaVersion(db)}`)
    }
  } catch (err) {
    if (err instanceof SchemaTooNewError) {
      return fatal('This data was saved by a newer version of ScribeCore.', err.message)
    }
    if (err instanceof NotScribeCoreDatabaseError) {
      return fatal(
        'ScribeCore cannot open its data file.',
        `${err.message}\n\nFile: ${location.dbPath}\nBackups: ${location.backupsDir}`,
      )
    }
    return fatal('ScribeCore cannot open its data file.', `${(err as Error).message}\n\nFile: ${location.dbPath}`)
  }

  // Housekeeping must never stop the app from starting.
  try {
    const purged = repo().purgeTrash()
    if (purged > 0) log.info(`Removed ${purged} entries that were in Trash for more than 30 days`)
  } catch (err) {
    log.error('Trash cleanup failed', err)
  }
  try {
    const backup = await runDailyBackup(db, location.backupsDir)
    if (backup) log.info(`Daily backup written: ${backup}`)
  } catch (err) {
    log.error('Daily backup failed', err)
  }
  return true
}

function closeDatabase(): void {
  if (!db) return
  try {
    db.close()
  } catch (err) {
    log.error('Closing the database failed', err)
  }
  db = null
  repository = null
}

// One running copy only, so two processes never open the same database.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID)
    lockDownSession()
    if (!chooseDataFolder() || !(await startDatabase())) {
      app.exit(1)
      return
    }
    registerAppIpc()
    registerDataIpc(repo)
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', closeDatabase)
}
