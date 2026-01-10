import { app, Menu, dialog } from 'electron'
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
import { LinkRouterService } from './routing/link-router-service'
import { attachKeyboardShortcuts } from './policy/keyboard-shortcuts'

const logger = createLogger()

// 注册自定义协议处理器
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('portalkit', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('portalkit')
}

app.whenReady().then(async () => {
  const appConfig = new AppConfigStore(appConfigPath())
  const config = await appConfig.load().catch(() => null)
  const win = createMainWindow({
    initialSize: {
      width: config?.window?.initialWidth,
      height: config?.window?.initialHeight
    }
  })
  if (process.platform !== 'darwin') {
    win.setMenuBarVisibility(false)
  }
  attachKeyboardShortcuts(win.webContents, (channel, payload) => win.webContents.send(channel, payload))
  const profiles = new ProfileStore(profilesPath())
  const workspace = new WorkspaceStore(workspacePath())
  const linkRouter = new LinkRouterService({ configStore: appConfig, profileStore: profiles, logger })
  await linkRouter.init()

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
    linkRouter,
    notify: (channel, payload) => win.webContents.send(channel, payload)
  })
  await restoreWorkspaceAtStartup(webapps, logger)

  // 处理 portalkit:// 协议 URL
  const handleProtocolUrl = async (url: string) => {
    logger.info('protocol.received', { url })

    // 解析 portalkit://open?url=<encoded-url>
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'portalkit:') return

      const targetUrl = parsed.searchParams.get('url')
      if (!targetUrl) {
        logger.warn('protocol.missingUrl', { url })
        return
      }

      const route = await linkRouter.getRouteForUrl(targetUrl)
      if (route.matched && route.profileId) {
        // 找到匹配的应用，直接打开
        await (webapps as any).openProfileWithUrl(route.profileId, targetUrl)

        // 如果是自动匹配的，通知用户
        if (route.autoMatched) {
          win.webContents.send('linkRouter.autoMatched', {
            url: targetUrl,
            profileId: route.profileId
          })
        }
      } else {
        // 没有匹配到任何应用，自动创建临时应用
        const domain = new URL(targetUrl).hostname
        logger.info('protocol.autoCreateTempApp', { url: targetUrl, domain })

        // 自动创建临时应用（不持久化）
        const tempProfile = await profiles.create({
          name: `${domain} (临时)`,
          startUrl: `https://${domain}`,
          allowedOrigins: [`https://${domain}`],
          pinned: false,
          isolation: {
            partition: `persist:temp-${domain.replace(/\./g, '-')}`
          },
          externalLinks: {
            policy: 'open-in-system'
          },
          temporary: true // 标记为临时应用
        })

        logger.info('protocol.tempProfileCreated', {
          profileId: tempProfile.id,
          temporary: tempProfile.temporary,
          name: tempProfile.name
        })

        // 将临时应用注册到 WebAppManager
        ;(webapps as any).registerTempProfile(tempProfile)

        // 验证注册
        const tempProfiles = (webapps as any).getTempProfiles()
        logger.info('protocol.tempProfilesCount', { count: tempProfiles.length })

        // 在临时应用中打开 URL
        await (webapps as any).openProfileWithUrl(tempProfile.id, targetUrl)

        // 通知前端刷新应用列表
        win.webContents.send('profiles.changed', {})

        logger.info('protocol.tempAppCreated', { profileId: tempProfile.id, domain })

        // 使用原生对话框询问用户是否保存
        setTimeout(() => {
          dialog.showMessageBox(win, {
            type: 'info',
            title: '临时应用',
            message: `已在临时应用中打开 ${domain}`,
            detail: '这是一个临时应用，关闭后将不会保存。\n\n是否要将其保存为正式应用？',
            buttons: ['保存为正式应用', '暂不保存'],
            defaultId: 0,
            cancelId: 1
          }).then(result => {
            if (result.response === 0) {
              // 用户选择保存
              void profiles.update(tempProfile.id, { temporary: false, pinned: true }).then(() => {
                ;(webapps as any).removeTempProfile(tempProfile.id)
                win.webContents.send('profiles.changed', {})
                logger.info('protocol.tempAppSaved', { profileId: tempProfile.id })
              })
            }
          })
        }, 1000) // 延迟1秒显示，让页面先加载
      }
    } catch (err) {
      logger.error('protocol.handleError', { url, error: String(err) })
    }
  }

  // macOS: 通过 open-url 事件接收协议 URL
  app.on('open-url', (event, url) => {
    event.preventDefault()
    void handleProtocolUrl(url)
  })

  // Windows/Linux: 通过 second-instance 事件接收
  app.on('second-instance', (_event, commandLine) => {
    const url = commandLine.find((arg) => arg.startsWith('portalkit://'))
    if (url) void handleProtocolUrl(url)

    // 聚焦主窗口
    if (win.isMinimized()) win.restore()
    win.focus()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
