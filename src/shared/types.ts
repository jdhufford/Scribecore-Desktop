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
} as const
