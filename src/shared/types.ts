// Types shared by the main process, the preload bridge and the renderer.

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  platform: string
  arch: string
}

/** The API the preload script exposes on `window.scribecore`. */
export interface ScribeCoreApi {
  getAppInfo(): Promise<AppInfo>
  openReleasesPage(): Promise<void>
}

/** IPC channel names, kept in one place so main and preload cannot drift apart. */
export const IPC = {
  appInfo: 'app:info',
  openReleases: 'app:open-releases',
} as const
