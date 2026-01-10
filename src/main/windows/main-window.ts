import { BrowserWindow, nativeTheme, screen } from 'electron'
import { join } from 'node:path'
import { createSafeWebPreferences } from '../security/web-preferences'

export const UI_SIDEBAR_WIDTH = 56
export const UI_TOPBAR_HEIGHT = 38
const UI_TRAFFIC_LIGHTS_HEIGHT = 14

function getOpaqueWindowBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#0d0d0f' : '#f2f2f7'
}

function clampWindowSize(args: { width: number; height: number; minWidth: number; minHeight: number; workArea: { width: number; height: number } }) {
  const width = Math.max(args.minWidth, Math.min(args.workArea.width, args.width))
  const height = Math.max(args.minHeight, Math.min(args.workArea.height, args.height))
  return { width, height }
}

export function createMainWindow(args?: { initialSize?: { width?: number; height?: number } }) {
  const preloadPath = join(__dirname, '../preload/ipc-bridge.js')
  const isMac = process.platform === 'darwin'
  const isWin = process.platform === 'win32'
  const workArea = screen.getPrimaryDisplay().workAreaSize

  const defaultWidth = Math.max(900, Math.min(1400, Math.round(workArea.width * 0.9)))
  const defaultHeight = Math.max(640, Math.min(1000, Math.round(workArea.height * 0.9)))
  const requestedWidth = args?.initialSize?.width ?? defaultWidth
  const requestedHeight = args?.initialSize?.height ?? defaultHeight
  const initial = clampWindowSize({
    width: requestedWidth,
    height: requestedHeight,
    minWidth: 800,
    minHeight: 600,
    workArea
  })

  const win = new BrowserWindow({
    width: initial.width,
    height: initial.height,
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
