import type { ExternalLinksPolicy } from '../../shared/types'
import type { WebContents } from 'electron'
import { BrowserWindow, dialog, shell } from 'electron'
import { openPopupWindow } from '../windows/popup-window'

export interface ExternalLinkContext {
  partition?: string
  parentWindow?: BrowserWindow | null
  returnTo?: { webContents: WebContents; allowedOrigins: string[] }
}

export function attachPopupReturnTo(args: {
  popup: BrowserWindow
  parentWindow?: BrowserWindow | null
  returnTo: WebContents
  allowedOrigins: string[]
}) {
  const { popup, parentWindow, returnTo, allowedOrigins } = args
  let returned = false

  const tryReturn = (nextUrl: string) => {
    if (returned) return
    if (popup.isDestroyed()) return
    if (returnTo.isDestroyed()) return
    if (!isAllowedOrigin(nextUrl, allowedOrigins)) return
    returned = true
    parentWindow?.focus()
    void returnTo.loadURL(nextUrl)
    popup.close()
  }

  popup.webContents.on('did-navigate', (_event, nextUrl) => tryReturn(nextUrl))
  popup.webContents.on('did-navigate-in-page', (_event, nextUrl) => tryReturn(nextUrl))
}

export async function handleExternalLink(
  policy: ExternalLinksPolicy,
  url: string,
  context?: ExternalLinkContext
) {
  const parsed = safeParseHttpUrl(url)
  if (!parsed) return { action: 'blocked' as const, reason: 'unsupported_protocol' as const }

  if (policy === 'block') return { action: 'blocked' as const }

  if (policy === 'open-in-popup') {
    if (!context?.partition) {
      await shell.openExternal(parsed.href, { activate: true })
      return { action: 'opened' as const, target: 'system' as const }
    }
    const popup = openPopupWindow({
      url: parsed.href,
      partition: context.partition,
      parentWindow: context.parentWindow
    })
    if (context.returnTo) {
      attachPopupReturnTo({
        popup,
        parentWindow: context.parentWindow,
        returnTo: context.returnTo.webContents,
        allowedOrigins: context.returnTo.allowedOrigins
      })
    }
    return { action: 'opened' as const, target: 'popup' as const }
  }

  if (policy === 'ask') {
    const win = context?.parentWindow ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      title: '打开外部链接',
      message: '即将在系统浏览器打开外部链接',
      detail: parsed.href,
      buttons: ['打开', '取消'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })
    if (result.response !== 0) return { action: 'blocked' as const, reason: 'user_cancelled' as const }
  }

  await shell.openExternal(parsed.href, { activate: true })
  return { action: 'opened' as const, target: 'system' as const }
}

function safeParseHttpUrl(input: string): URL | null {
  try {
    const u = new URL(input)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u
  } catch {
    return null
  }
}

function isAllowedOrigin(url: string, allowedOrigins: string[]) {
  try {
    const origin = new URL(url).origin
    return allowedOrigins.includes(origin)
  } catch {
    return false
  }
}
