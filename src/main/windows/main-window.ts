import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { createSafeWebPreferences } from '../security/web-preferences'

export const UI_SIDEBAR_WIDTH = 56
export const UI_TOPBAR_HEIGHT = 38
const UI_TRAFFIC_LIGHTS_HEIGHT = 14

export function createMainWindow() {
  const preloadPath = join(__dirname, '../preload/ipc-bridge.js')
  const isMac = process.platform === 'darwin'

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: Math.round((UI_TOPBAR_HEIGHT - UI_TRAFFIC_LIGHTS_HEIGHT) / 2) },
    ...(isMac
      ? {
          transparent: true,
          backgroundColor: '#00000000',
          vibrancy: 'under-window' as const,
          visualEffectState: 'active' as const
        }
      : {}),
    webPreferences: createSafeWebPreferences(preloadPath)
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
