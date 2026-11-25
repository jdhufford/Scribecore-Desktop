import { Menu, app, dialog, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { IPC, type MenuCommand } from '../shared/types'
import { PROJECT_URL, RELEASES_URL } from './security'

// Application menu (SPEC 4: File, Edit, View, Help).

export function buildMenu(getWindow: () => BrowserWindow | null, about: () => string): Menu {
  const send = (command: MenuCommand) => () => getWindow()?.webContents.send(IPC.menuCommand, command)
  const dev = !app.isPackaged

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&File',
      submenu: [
        { label: '&New Entry', accelerator: 'CmdOrCtrl+N', click: send('new-entry') },
        { type: 'separator' },
        { label: '&Settings…', accelerator: 'CmdOrCtrl+,', click: send('settings') },
        { type: 'separator' },
        { role: 'quit', label: 'E&xit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        // Undo is routed through the renderer: text undo inside a field, otherwise
        // it restores the last entry moved to Trash.
        { label: '&Undo', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: '&Find', accelerator: 'CmdOrCtrl+F', click: send('find') },
      ],
    },
    {
      label: '&View',
      submenu: [
        { label: '&Compact View', accelerator: 'CmdOrCtrl+Shift+C', click: send('toggle-compact') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(dev ? ([{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] as const) : []),
      ],
    },
    {
      label: '&Help',
      submenu: [
        { label: 'ScribeCore on &GitHub', click: () => void shell.openExternal(PROJECT_URL) },
        { label: 'Check for &Newer Versions', click: () => void shell.openExternal(RELEASES_URL) },
        { type: 'separator' },
        {
          label: '&About ScribeCore',
          click: () => {
            const win = getWindow()
            const options = {
              type: 'info' as const,
              title: 'About ScribeCore',
              message: `ScribeCore ${app.getVersion()}`,
              detail: about(),
              buttons: ['OK'],
            }
            void (win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options))
          },
        },
      ],
    },
  ]
  return Menu.buildFromTemplate(template)
}
