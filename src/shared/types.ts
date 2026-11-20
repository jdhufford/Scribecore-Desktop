// Types shared by the main process, the preload bridge and the renderer.

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  platform: string
  arch: string
  dataDir: string
  portable: boolean
  /** Name of the sync service the data folder is inside (OneDrive, Dropbox...), if any. */
  syncFolder: string | null
  schemaVersion: number
  /** Windows regional-format locale (e.g. en-US, en-GB), used to display dates. */
  locale: string
}

export type Theme = 'system' | 'light' | 'dark'
export type ViewMode = 'normal' | 'compact'

/** User preferences stored in the database `settings` table. */
export interface Settings {
  theme: Theme
  viewMode: ViewMode
  tagMode: TagMode
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', viewMode: 'normal', tagMode: 'and' }

/** Commands sent from the menu bar (and other main-process sources) to the renderer. */
export type MenuCommand = 'new-entry' | 'find' | 'toggle-compact' | 'settings' | 'undo'

export interface ConfirmOptions {
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

export interface Activity {
  id: number
  /** YYYY-MM-DD, the day the work happened (local calendar date). */
  date: string
  task: string
  notes: string | null
  tags: string[]
  /** ISO 8601 UTC timestamps. */
  createdAt: string
  updatedAt: string
  /** Set when the entry is in Trash. */
  deletedAt: string | null
}

export interface ActivityInput {
  date: string
  task: string
  notes?: string | null
  tags?: string[]
}

export type TagMode = 'and' | 'or'

export interface ActivityFilter {
  /** Case-insensitive text search over task and notes. */
  search?: string
  tags?: string[]
  /** 'and' = entry has every selected tag (default); 'or' = any of them. */
  tagMode?: TagMode
  /** Inclusive YYYY-MM-DD bounds. */
  from?: string
  to?: string
  /** true = list Trash instead of live entries. */
  trash?: boolean
}

export interface TagCount {
  name: string
  /** Live (not trashed) entries using the tag. */
  count: number
  /** Latest entry date using the tag, or null if unused. */
  lastUsed: string | null
}

export type ErrorCode = 'validation' | 'not_found' | 'internal'

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ErrorCode; message: string; field?: string } }

/** The API the preload script exposes on `window.scribecore`. */
export interface ScribeCoreApi {
  getAppInfo(): Promise<AppInfo>
  openReleasesPage(): Promise<void>
  activities: {
    list(filter?: ActivityFilter): Promise<Result<Activity[]>>
    get(id: number): Promise<Result<Activity>>
    create(input: ActivityInput): Promise<Result<Activity>>
    update(id: number, input: ActivityInput): Promise<Result<Activity>>
    trash(id: number): Promise<Result<void>>
    restore(id: number): Promise<Result<void>>
    deleteForever(id: number): Promise<Result<void>>
    emptyTrash(): Promise<Result<number>>
  }
  tags: {
    list(): Promise<Result<TagCount[]>>
    suggest(task: string, notes: string): Promise<Result<string[]>>
  }
  settings: {
    get(): Promise<Settings>
    set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<Result<Settings>>
  }
  ui: {
    /** Native confirmation dialog; resolves true if the user confirmed. */
    confirm(options: ConfirmOptions): Promise<boolean>
    /** Tell the main process whether there are unsaved form changes (checked on window close). */
    setDirty(dirty: boolean): void
    /** Subscribe to menu commands. Returns an unsubscribe function. */
    onMenuCommand(callback: (command: MenuCommand) => void): () => void
  }
}

/** IPC channel names, kept in one place so main and preload cannot drift apart. */
export const IPC = {
  appInfo: 'app:info',
  openReleases: 'app:open-releases',
  activitiesList: 'activities:list',
  activitiesGet: 'activities:get',
  activitiesCreate: 'activities:create',
  activitiesUpdate: 'activities:update',
  activitiesTrash: 'activities:trash',
  activitiesRestore: 'activities:restore',
  activitiesDeleteForever: 'activities:delete-forever',
  activitiesEmptyTrash: 'activities:empty-trash',
  tagsList: 'tags:list',
  tagsSuggest: 'tags:suggest',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  uiConfirm: 'ui:confirm',
  uiSetDirty: 'ui:set-dirty',
  menuCommand: 'menu:command',
} as const
