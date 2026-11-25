import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, screen, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { IPC, type AppInfo, type ConfirmOptions } from '../shared/types'
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
import { buildMenu } from './menu'
import {
  detectSyncFolder,
  isWritableDir,
  locationFor,
  resolveDataLocation,
  type DataLocation,
} from './paths'
import { RELEASES_URL, isAllowedExternalUrl, isAllowedRequest } from './security'
import { readSettings, writeSetting } from './settings'
import { DEFAULT_SIZE, MIN_HEIGHT, MIN_WIDTH, parseWindowState, restoreBounds } from './window-state'

const APP_ID = 'io.github.jdhufford.scribecore'
const devServerUrl = !app.isPackaged ? process.env['ELECTRON_RENDERER_URL'] : undefined

// ---- Data location: decided before 'ready', because Chromium's own files go there too.
// SCRIBECORE_DATA_DIR (development and automated tests only) points a run at a throwaway folder.
const devDataDir = !app.isPackaged ? process.env['SCRIBECORE_DATA_DIR'] : undefined
let location: DataLocation = devDataDir
  ? locationFor(devDataDir, false)
  : resolveDataLocation({
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
/** True while the renderer has unsaved form changes. */
let rendererDirty = false

function repo(): Repository {
  if (!repository) throw new Error('Database is not open')
  return repository
}

function openExternal(url: string): void {
  if (isAllowedExternalUrl(url)) void shell.openExternal(url)
}

const WINDOW_STATE_KEY = 'window'

function saveWindowState(win: BrowserWindow): void {
  try {
    const state = { bounds: win.getNormalBounds(), maximized: win.isMaximized() }
    repository?.setSetting(WINDOW_STATE_KEY, JSON.stringify(state))
  } catch (err) {
    log.warn('Could not save window position', err)
  }
}

function createWindow(): void {
  const saved = parseWindowState(repository?.getSetting(WINDOW_STATE_KEY) ?? null)
  const bounds = restoreBounds(
    saved,
    screen.getAllDisplays().map((d) => d.workArea),
  )
  mainWindow = new BrowserWindow({
    ...(bounds ?? DEFAULT_SIZE),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
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

  mainWindow.once('ready-to-show', () => {
    if (bounds && saved?.maximized) mainWindow?.maximize()
    mainWindow?.show()
  })
  // Unsaved form changes: ask before closing (SPEC 10).
  mainWindow.on('close', (event) => {
    const win = mainWindow
    if (!win) return
    if (rendererDirty) {
      const choice = dialog.showMessageBoxSync(win, {
        type: 'warning',
        title: 'ScribeCore',
        message: 'You have an entry with unsaved changes.',
        detail: 'Close ScribeCore and discard them?',
        buttons: ['Keep editing', 'Discard and close'],
        defaultId: 0,
        cancelId: 0,
      })
      if (choice === 0) {
        event.preventDefault()
        return
      }
      rendererDirty = false
    }
    saveWindowState(win)
  })
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
      locale: app.getSystemLocale() || app.getLocale(),
    }),
  )
  ipcMain.handle(IPC.openReleases, () => shell.openExternal(RELEASES_URL))

  ipcMain.handle(IPC.settingsGet, () => readSettings(repo()))
  ipcMain.handle(IPC.settingsSet, (_e, key: unknown, value: unknown) => {
    try {
      const settings = writeSetting(repo(), key, value)
      nativeTheme.themeSource = settings.theme
      return { ok: true, value: settings }
    } catch (err) {
      return { ok: false, error: { code: 'validation', message: (err as Error).message } }
    }
  })

  ipcMain.handle(IPC.uiConfirm, async (event, raw: unknown) => {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Partial<ConfirmOptions>
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = {
      type: (o.danger ? 'warning' : 'question') as 'warning' | 'question',
      title: 'ScribeCore',
      message: String(o.message ?? ''),
      detail: o.detail ? String(o.detail) : undefined,
      buttons: [String(o.cancelLabel ?? 'Cancel'), String(o.confirmLabel ?? 'OK')],
      defaultId: o.danger ? 0 : 1,
      cancelId: 0,
      noLink: true,
    }
    const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
    return response === 1
  })
  ipcMain.on(IPC.uiSetDirty, (_e, dirty: unknown) => {
    rendererDirty = dirty === true
  })
}

function aboutText(): string {
  return [
    'A private, local work-activity log.',
    '',
    `Data folder: ${location.dataDir}${location.portable ? ' (portable)' : ''}`,
    `Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`,
    '',
    'Free software under the GNU General Public License v3.0 or later.',
  ].join('\n')
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
    nativeTheme.themeSource = readSettings(repo()).theme
    registerAppIpc()
    registerDataIpc(repo)
    Menu.setApplicationMenu(buildMenu(() => mainWindow, aboutText))
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
  app.on('will-quit', closeDatabase)
}
