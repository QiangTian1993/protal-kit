import { BrowserWindow } from 'electron'
import type { WebAppProfile, Workspace } from '../../shared/types'
import type { ProfileStore } from '../storage/profile-store'
import type { WorkspaceStore } from '../storage/workspace-store'
import type { Logger } from '../observability/logger'
import { createWebAppView } from './webapp-factory'
import { UI_SIDEBAR_WIDTH, UI_TOPBAR_HEIGHT } from '../windows/main-window'
import { logSwitch } from '../observability/events'
import type { ManagedView } from './types'
import { evictLru } from './resource-strategy'
import { errorPageUrl, loadingPageUrl } from './system-pages'
import { PerfTracker } from '../observability/perf'
import type { BrowserView } from 'electron'
import { attachNavigationGuards } from '../policy/navigation-hooks'
import { snapshotPath } from '../storage/paths'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'

export class WebAppManager {
  private win: BrowserWindow
  private profiles: ProfileStore
  private workspaceStore: WorkspaceStore
  private logger: Logger
  private notify: (channel: string, payload: unknown) => void
  private perf = new PerfTracker()
  private views = new Map<string, ManagedView>()
  private tempProfiles = new Map<string, WebAppProfile>() // 内存中的临时应用
  private activeProfileId: string | null = null
  private activeViewHideCount = 0
  private maxKeptAlive = 10
  private layoutConfig = { sidebarWidth: UI_SIDEBAR_WIDTH, topbarHeight: UI_TOPBAR_HEIGHT, rightInset: 0 }
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private idleTimeoutMs = 5 * 60 * 1000 // 5分钟空闲后休眠

  constructor(args: {
    win: BrowserWindow
    profiles: ProfileStore
    workspace: WorkspaceStore
    logger: Logger
    notify: (channel: string, payload: unknown) => void
  }) {
    this.win = args.win
    this.profiles = args.profiles
    this.workspaceStore = args.workspace
    this.logger = args.logger
    this.notify = args.notify

    this.win.on('resize', () => this.layout())
  }

  async openProfile(profileId: string) {
    await this.ensureView(profileId)
    await this.switchToProfile(profileId)
  }

  async openProfileWithUrl(profileId: string, url: string) {
    await this.ensureView(profileId)
    await this.switchToProfile(profileId)

    // 加载指定的 URL
    const managed = this.views.get(profileId)
    if (managed) {
      this.logger.info('webapps.openWithUrl', { profileId, url })
      await managed.view.webContents.loadURL(url)
    }
  }

  registerTempProfile(profile: WebAppProfile) {
    // 注册临时应用到内存
    this.tempProfiles.set(profile.id, profile)
    this.logger.info('webapps.tempProfileRegistered', { profileId: profile.id })
  }

  removeTempProfile(profileId: string) {
    // 从临时应用列表中移除
    this.tempProfiles.delete(profileId)
    this.logger.info('webapps.tempProfileRemoved', { profileId })
  }

  getTempProfiles(): WebAppProfile[] {
    return Array.from(this.tempProfiles.values())
  }

  async switchToProfile(profileId: string) {
    const from = this.activeProfileId
    if (from === profileId) return
    await this.ensureView(profileId)
    if (from) {
      this.detach(from)
      this.startIdleTimer(from) // 启动空闲计时器
    }
    this.attach(profileId)
    this.stopIdleTimer(profileId) // 停止空闲计时器
    this.activeProfileId = profileId
    logSwitch(this.logger, from, profileId)
    this.perf.markSwitchStart(profileId)
    this.notify('workspace.activeChanged', { profileId })
    await this.persistWorkspace()
  }

  async closeProfile(profileId: string) {
    if (this.activeProfileId === profileId) {
      this.detach(profileId)
      this.activeProfileId = null
      this.notify('workspace.activeChanged', { profileId: null })
    }
    const managed = this.views.get(profileId)
    if (managed) {
      managed.view.webContents.destroy()
      this.views.delete(profileId)
    }
    await this.persistWorkspace()
  }

  async reloadProfile(profileId: string) {
    await this.ensureView(profileId)
    const managed = this.views.get(profileId)
    if (!managed) return
    this.logger.info('webapps.reload', { profileId })
    managed.view.webContents.reload()
  }

  hideActiveView() {
    this.activeViewHideCount += 1
    if (!this.activeProfileId) return
    const managed = this.views.get(this.activeProfileId)
    if (!managed || !this.isAttached(managed.view)) return
    this.win.removeBrowserView(managed.view)
  }

  showActiveView() {
    this.activeViewHideCount = Math.max(0, this.activeViewHideCount - 1)
    if (this.activeViewHideCount > 0) return
    if (!this.activeProfileId) return
    this.attach(this.activeProfileId)
  }

  updateProfile(profile: WebAppProfile) {
    const managed = this.views.get(profile.id)
    if (!managed) return
    managed.profile = profile
  }

  async restoreFromWorkspace() {
    const workspace = await this.workspaceStore.load()
    const ensuredProfileIds: string[] = []
    for (const id of workspace.openProfileIds) {
      try {
        await this.ensureView(id)
        ensuredProfileIds.push(id)
      } catch (err: any) {
        this.logger.warn('workspace.restore.missingProfile', { profileId: id, message: err?.message ?? String(err) })
      }
    }

    const restoreActive = async (profileId: string) => {
      await this.switchToProfile(profileId)
      const state = workspace.perProfileState[profileId]
      if (!state?.lastUrl) return
      const managed = this.views.get(profileId)
      if (managed) void managed.view.webContents.loadURL(state.lastUrl)
    }

    if (workspace.activeProfileId && ensuredProfileIds.includes(workspace.activeProfileId)) {
      await restoreActive(workspace.activeProfileId)
      return
    }

    if (ensuredProfileIds.length > 0) {
      await restoreActive(ensuredProfileIds[0])
      return
    }

    const profiles = await this.profiles.list()
    if (profiles.length === 0) return
    const sorted = [...profiles].sort((a, b) => {
      const aPinned = a.pinned ?? true
      const bPinned = b.pinned ?? true
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      const aGroup = (a.group ?? '').trim()
      const bGroup = (b.group ?? '').trim()
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup)
      const orderDiff = (a.order ?? 0) - (b.order ?? 0)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })
    await this.openProfile(sorted[0]!.id)
  }

  setLayout(config: { sidebarWidth: number; topbarHeight: number; rightInset: number }) {
    this.layoutConfig = {
      sidebarWidth: config.sidebarWidth,
      topbarHeight: config.topbarHeight,
      rightInset: config.rightInset
    }
    this.layout()
  }

  updateLayout(config: Partial<{ sidebarWidth: number; topbarHeight: number; rightInset: number }>) {
    this.layoutConfig = {
      sidebarWidth: config.sidebarWidth ?? this.layoutConfig.sidebarWidth,
      topbarHeight: config.topbarHeight ?? this.layoutConfig.topbarHeight,
      rightInset: config.rightInset ?? this.layoutConfig.rightInset
    }
    this.layout()
  }

  private async ensureView(profileId: string) {
    if (this.views.has(profileId)) {
      const v = this.views.get(profileId)!
      v.lastActivatedAt = Date.now()
      return
    }

    // 先检查临时应用
    let profile = this.tempProfiles.get(profileId)

    // 如果不是临时应用，从持久化存储中查找
    if (!profile) {
      const profiles = await this.profiles.list()
      profile = profiles.find((p) => p.id === profileId)
    }

    if (!profile) throw new Error(`profile_not_found:${profileId}`)

    const view = createWebAppView(profile)
    this.views.set(profileId, { profile, view, lastActivatedAt: Date.now() })

    attachNavigationGuards({
      webContents: view.webContents,
      allowedOrigins: () => this.views.get(profileId)?.profile.allowedOrigins ?? profile.allowedOrigins,
      externalLinksPolicy: () =>
        this.views.get(profileId)?.profile.externalLinks.policy ?? profile.externalLinks.policy,
      partition: profile.isolation.partition,
      logger: this.logger
    })

    await view.webContents.loadURL(loadingPageUrl(profile.name))
    void view.webContents.loadURL(profile.startUrl)

    view.webContents.on('did-start-loading', () => {
      this.notify('webapp.loading', { profileId })
    })
    view.webContents.on('did-stop-loading', () => {
      this.notify('webapp.loaded', { profileId })
      if (this.activeProfileId === profileId) this.perf.markSwitchInteractive(this.logger, profileId)
    })
    view.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return
      const message = `${errorCode}: ${errorDescription}`
      this.notify('webapp.loadFailed', { profileId, message })
      this.logger.warn('webapp.loadFailed', { profileId, message, url: validatedURL })
      if (validatedURL.startsWith('data:text/html')) return
      void view.webContents.loadURL(errorPageUrl({ title: profile.name, message, url: validatedURL }))
    })

    view.webContents.on('did-navigate-in-page', (_e, url) => this.onUrl(profileId, url))
    view.webContents.on('did-navigate', (_e, url) => this.onUrl(profileId, url))

    const evicted = evictLru({ views: this.views, max: this.maxKeptAlive, activeProfileId: this.activeProfileId })
    for (const id of evicted) {
      const m = this.views.get(id)
      if (!m) continue
      // 优先休眠而不是直接销毁
      this.logger.info('webapps.evict.hibernate', { profileId: id })
      await this.hibernateProfile(id)
    }
  }

  private attach(profileId: string) {
    if (this.activeViewHideCount > 0) return
    const managed = this.views.get(profileId)
    if (!managed) return
    const existingViews = this.win.getBrowserViews()
    const overlayViews = existingViews.filter((v) => v !== managed.view)
    if (!existingViews.includes(managed.view)) this.win.addBrowserView(managed.view)
    this.layoutView(managed.view)
    for (const view of overlayViews) this.win.setTopBrowserView(view)
  }

  private detach(profileId: string) {
    const managed = this.views.get(profileId)
    if (!managed) return
    if (!this.isAttached(managed.view)) return
    this.win.removeBrowserView(managed.view)
  }

  private layout() {
    if (!this.activeProfileId) return
    const managed = this.views.get(this.activeProfileId)
    if (!managed) return
    if (!this.isAttached(managed.view)) return
    this.layoutView(managed.view)
  }

  private layoutView(view: BrowserView) {
    const bounds = this.win.getContentBounds()
    const { sidebarWidth, topbarHeight, rightInset } = this.layoutConfig
    view.setBounds({
      x: sidebarWidth,
      y: topbarHeight,
      width: Math.max(0, bounds.width - sidebarWidth - rightInset),
      height: Math.max(0, bounds.height - topbarHeight)
    })
  }

  private isAttached(view: BrowserView) {
    return this.win.getBrowserViews().includes(view)
  }

  private async onUrl(profileId: string, url: string) {
    const ws = await this.workspaceStore.load()
    ws.perProfileState[profileId] = {
      ...(ws.perProfileState[profileId] ?? {}),
      lastUrl: url,
      lastActivatedAt: new Date().toISOString()
    }
    ws.updatedAt = new Date().toISOString()
    await this.workspaceStore.save(ws)
  }

  async hibernateProfile(profileId: string) {
    const managed = this.views.get(profileId)
    if (!managed) {
      this.logger.warn('hibernate.profileNotFound', { profileId })
      return
    }

    // 不休眠当前活跃的应用
    if (this.activeProfileId === profileId) {
      this.logger.info('hibernate.skipActive', { profileId })
      return
    }

    // 检查是否正在播放媒体
    if (managed.view.webContents.isCurrentlyAudible()) {
      this.logger.info('hibernate.skipAudible', { profileId })
      return
    }

    try {
      // 捕获截图
      const image = await managed.view.webContents.capturePage()
      const imagePath = snapshotPath(profileId)
      writeFileSync(imagePath, image.toPNG())

      // 更新 workspace 状态
      const ws = await this.workspaceStore.load()
      ws.perProfileState[profileId] = {
        ...(ws.perProfileState[profileId] ?? {}),
        status: 'hibernated',
        hibernatedAt: new Date().toISOString(),
        snapshotPath: imagePath
      }
      ws.updatedAt = new Date().toISOString()
      await this.workspaceStore.save(ws)

      // 销毁 webContents 释放内存
      managed.view.webContents.destroy()
      this.views.delete(profileId)

      this.logger.info('hibernate.success', { profileId })
      this.notify('webapp.hibernated', { profileId })
    } catch (err) {
      this.logger.error('hibernate.failed', { profileId, error: String(err) })
    }
  }

  async restoreProfile(profileId: string) {
    const ws = await this.workspaceStore.load()
    const state = ws.perProfileState[profileId]

    if (!state || state.status !== 'hibernated') {
      this.logger.warn('restore.notHibernated', { profileId })
      return
    }

    try {
      // 重新创建 view
      await this.ensureView(profileId)

      // 恢复到上次的 URL
      if (state.lastUrl) {
        const managed = this.views.get(profileId)
        if (managed) {
          await managed.view.webContents.loadURL(state.lastUrl)
        }
      }

      // 更新状态
      ws.perProfileState[profileId] = {
        ...state,
        status: 'background',
        hibernatedAt: undefined,
        snapshotPath: undefined
      }
      ws.updatedAt = new Date().toISOString()
      await this.workspaceStore.save(ws)

      // 删除快照文件
      if (state.snapshotPath && existsSync(state.snapshotPath)) {
        unlinkSync(state.snapshotPath)
      }

      this.logger.info('restore.success', { profileId })
      this.notify('webapp.restored', { profileId })
    } catch (err) {
      this.logger.error('restore.failed', { profileId, error: String(err) })
    }
  }

  private startIdleTimer(profileId: string) {
    // 清除已存在的计时器
    this.stopIdleTimer(profileId)

    // 启动新的空闲计时器
    const timer = setTimeout(() => {
      this.logger.info('idle.timeout', { profileId })
      void this.hibernateProfile(profileId)
    }, this.idleTimeoutMs)

    this.idleTimers.set(profileId, timer)
  }

  private stopIdleTimer(profileId: string) {
    const timer = this.idleTimers.get(profileId)
    if (timer) {
      clearTimeout(timer)
      this.idleTimers.delete(profileId)
    }
  }

  private async persistWorkspace() {
    const ws: Workspace = await this.workspaceStore.load()
    ws.activeProfileId = this.activeProfileId ?? undefined
    ws.openProfileIds = [...this.views.keys()]
    ws.updatedAt = new Date().toISOString()
    await this.workspaceStore.save(ws)
  }
}
