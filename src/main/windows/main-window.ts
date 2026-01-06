import { BrowserWindow, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import { createSafeWebPreferences } from '../security/web-preferences'

export const UI_SIDEBAR_WIDTH = 56
export const UI_TOPBAR_HEIGHT = 38
const UI_TRAFFIC_LIGHTS_HEIGHT = 14

function getOpaqueWindowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#0d0d0f' : '#f2f2f7'
}

export function createMainWindow() {
  const preloadPath = join(__dirname, '../preload/ipc-bridge.js')
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const initialWidth = Math.max(900, Math.min(1400, Math.round(workArea.width * 0.9)))
  const initialHeight = Math.max(640, Math.min(1000, Math.round(workArea.height * 0.9)))

  const win = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    minWidth: 800,
    minHeight: 600,
    ...(isMac ? {} : { autoHideMenuBar: true }),
    ...(isWin
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: {
            color: getOpaqueWindowBackgroundColor(),
            symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#1c1c1e',
            height: UI_TOPBAR_HEIGHT
          }
        }
      : {}),
    backgroundColor: isMac ? '#00000000' : getOpaqueWindowBackgroundColor(),
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 16, y: Math.round((UI_TOPBAR_HEIGHT - UI_TRAFFIC_LIGHTS_HEIGHT) / 2) }
        }
      : {}),
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

  if (!isMac) {
    const updateBackground = () => {
      if (win.isDestroyed()) return
      win.setBackgroundColor(getOpaqueWindowBackgroundColor())
      if (isWin && typeof (win as any).setTitleBarOverlay === 'function') {
        ;(win as any).setTitleBarOverlay({
          color: getOpaqueWindowBackgroundColor(),
          symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#1c1c1e',
          height: UI_TOPBAR_HEIGHT
        })
      }
    }
    nativeTheme.on('updated', updateBackground)
    win.on('closed', () => nativeTheme.removeListener('updated', updateBackground))
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}
