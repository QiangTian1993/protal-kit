import { BrowserView, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'node:path'
import { createSafeWebPreferences } from '../security/web-preferences'
import { UI_TOPBAR_HEIGHT } from './main-window'

const SETTINGS_DRAWER_WIDTH = 560

export class SettingsWindowManager {
  private view: BrowserView | null = null
  private drawerOpened = false
  private topbarHeight = UI_TOPBAR_HEIGHT
  private onParentResized = () => this.syncBounds()

  constructor(
    private parent: BrowserWindow,
    private onDrawerChanged?: (payload: { opened: boolean; width: number }) => void
  ) {
    this.parent.on('resize', this.onParentResized)
    this.parent.on('closed', () => this.destroy())
  }

  open() {
    if (!this.view) this.view = this.createView()
    if (!this.view) return
    if (!this.isAttached()) this.parent.addBrowserView(this.view)
    this.parent.setTopBrowserView(this.view)
    this.view.setBounds(this.computeBounds())
    this.notifyDrawer(true)
    this.view.webContents.focus()
  }

  close() {
    if (!this.view) return
    if (this.isAttached()) this.parent.removeBrowserView(this.view)
    this.notifyDrawer(false)
  }

  updateLayout(config: Partial<{ topbarHeight: number }>) {
    this.topbarHeight = config.topbarHeight ?? this.topbarHeight
    this.syncBounds()
  }

  private createView() {
    const preloadPath = join(__dirname, '../preload/ipc-bridge.js')
    const view = new BrowserView({
      webPreferences: createSafeWebPreferences(preloadPath)
    })

    const wc = view.webContents as any
    if (typeof wc.setBackgroundColor === 'function') {
      let background = nativeTheme.shouldUseDarkColors ? '#111318' : '#f2f2f7'
      if (process.platform === 'darwin') background = '#00000000'
      wc.setBackgroundColor(background)
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      void view.webContents.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/settings`)
    } else {
      void view.webContents.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/settings' })
    }

    return view
  }

  private syncBounds() {
    if (!this.view) return
    if (!this.drawerOpened) return
    if (!this.isAttached()) return
    this.view.setBounds(this.computeBounds())
    this.notifyDrawerWidth()
  }

  private computeBounds() {
    const parentBounds = this.parent.getContentBounds()
    const width = Math.min(SETTINGS_DRAWER_WIDTH, parentBounds.width)
    return {
      x: 0,
      y: this.topbarHeight,
      width,
      height: Math.max(0, parentBounds.height - this.topbarHeight)
    }
  }

  private notifyDrawer(opened: boolean) {
    if (this.drawerOpened === opened) return
    this.drawerOpened = opened
    if (this.parent.isDestroyed()) return
    const payload = { opened, width: opened ? this.getInsetWidth() : 0 }
    this.onDrawerChanged?.(payload)
    this.parent.webContents.send('ui.settings.drawer', payload)
  }

  private getInsetWidth() {
    return this.computeBounds().width
  }

  private notifyDrawerWidth() {
    if (!this.drawerOpened) return
    if (this.parent.isDestroyed()) return
    const payload = { opened: true, width: this.getInsetWidth() }
    this.onDrawerChanged?.(payload)
    this.parent.webContents.send('ui.settings.drawer', payload)
  }

  private isAttached() {
    if (!this.view) return false
    return this.parent.getBrowserViews().includes(this.view)
  }

  private destroy() {
    if (!this.view) return
    try {
      if (this.isAttached()) this.parent.removeBrowserView(this.view)
    } finally {
      this.view.webContents.destroy()
      this.view = null
    }
  }
}
