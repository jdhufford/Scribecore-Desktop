import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ScribeCoreApi } from '../shared/types'

// The renderer runs sandboxed with no Node access. This bridge is the only way
// it can reach the main process, and it exposes named functions, never
// ipcRenderer itself.
const api: ScribeCoreApi = {
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo),
  openReleasesPage: () => ipcRenderer.invoke(IPC.openReleases),
  activities: {
    list: (filter) => ipcRenderer.invoke(IPC.activitiesList, filter ?? {}),
    get: (id) => ipcRenderer.invoke(IPC.activitiesGet, id),
    create: (input) => ipcRenderer.invoke(IPC.activitiesCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC.activitiesUpdate, id, input),
    trash: (id) => ipcRenderer.invoke(IPC.activitiesTrash, id),
    restore: (id) => ipcRenderer.invoke(IPC.activitiesRestore, id),
    deleteForever: (id) => ipcRenderer.invoke(IPC.activitiesDeleteForever, id),
    emptyTrash: () => ipcRenderer.invoke(IPC.activitiesEmptyTrash),
  },
  tags: {
    list: () => ipcRenderer.invoke(IPC.tagsList),
    suggest: (task, notes) => ipcRenderer.invoke(IPC.tagsSuggest, task, notes),
  },
}

contextBridge.exposeInMainWorld('scribecore', api)
