import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type MenuCommand, type ScribeCoreApi } from '../shared/types'

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
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value),
  },
  ui: {
    confirm: (options) => ipcRenderer.invoke(IPC.uiConfirm, options),
    setDirty: (dirty) => ipcRenderer.send(IPC.uiSetDirty, dirty),
    onMenuCommand: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, command: MenuCommand) => callback(command)
      ipcRenderer.on(IPC.menuCommand, listener)
      return () => ipcRenderer.removeListener(IPC.menuCommand, listener)
    },
  },
}

contextBridge.exposeInMainWorld('scribecore', api)
