import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ScribeCoreApi } from '../shared/types'

// The renderer runs sandboxed with no Node access. This bridge is the only way
// it can reach the main process, and it exposes named functions, never
// ipcRenderer itself.
const api: ScribeCoreApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  openReleasesPage: () => ipcRenderer.invoke(IPC.openReleases),
}

contextBridge.exposeInMainWorld('scribecore', api)
