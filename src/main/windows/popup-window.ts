import { BrowserWindow } from 'electron'
import { createSafeWebPreferences } from '../security/web-preferences'

export interface PopupWindowOptions {
  url: string
  partition: string
  parentWindow?: BrowserWindow | null
  width?: number
  height?: number
}

export function openPopupWindow(options: PopupWindowOptions): BrowserWindow {
  const { url, partition, parentWindow, width = 800, height = 600 } = options

  const popup = new BrowserWindow({
    width,
    height,
    parent: parentWindow ?? undefined,
    modal: false,
    show: false,
    webPreferences: createSafeWebPreferences(undefined, partition)
  })

  popup.once('ready-to-show', () => popup.show())

  popup.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    void popup.webContents.loadURL(newUrl)
    return { action: 'deny' }
  })

  void popup.loadURL(url)

  return popup
}
