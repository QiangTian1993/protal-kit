import { app, Menu } from 'electron'
import { createMainWindow } from './windows/main-window'
import { SettingsWindowManager } from './windows/settings-window'
import { ProfileStore } from './storage/profile-store'
import { WorkspaceStore } from './storage/workspace-store'
import { createLogger } from './observability/logger'
import { registerIpcHandlers } from './ipc/router'
import { WebAppManager } from './webapps/webapp-manager'
import { restoreWorkspaceAtStartup } from './app/startup-restore'
import { profilesPath, workspacePath, appConfigPath } from './storage/paths'
import { AppConfigStore } from './storage/app-config-store'

const logger = createLogger()

app.whenReady().then(async () => {
  const win = createMainWindow()
  const profiles = new ProfileStore(profilesPath())
  const workspace = new WorkspaceStore(workspacePath())
  const appConfig = new AppConfigStore(appConfigPath())
  const webapps = new WebAppManager({
    win,
    profiles,
    workspace,
    logger,
    notify: (channel, payload) => win.webContents.send(channel, payload)
  })
  const settingsWindow = new SettingsWindowManager(win)

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: '沉浸模式',
            id: 'app-immersive-toggle',
            type: 'checkbox',
            accelerator: 'CmdOrCtrl+Shift+M',
            click: (item) => win.webContents.send('ui.immersive.toggle', { enabled: item.checked })
          },
          {
            label: '设置…',
            accelerator: 'CmdOrCtrl+,',
            click: () => settingsWindow.open()
          },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: '视图',
        submenu: [
          {
            label: '切换侧边栏',
            accelerator: 'CmdOrCtrl+B',
            click: () => win.webContents.send('ui.sidebar.toggle', {})
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'toggleDevTools' }
        ]
      }
    ])
  )

  registerIpcHandlers({
    profiles,
    workspace,
    webapps,
    logger,
    settingsWindow,
    appConfig,
    notify: (channel, payload) => win.webContents.send(channel, payload)
  })
  await restoreWorkspaceAtStartup(webapps, logger)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
