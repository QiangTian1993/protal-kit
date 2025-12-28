import { BrowserWindow, type WebContents } from 'electron'
import { decideNavigation } from './navigation-policy'
import { attachPopupReturnTo, handleExternalLink } from './external-links'
import type { Logger } from '../observability/logger'
import type { ExternalLinksPolicy } from '../../shared/types'
import { createSafeWebPreferences } from '../security/web-preferences'

type ValueOrGetter<T> = T | (() => T)

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isAboutBlank(url: string) {
  return url === 'about:blank' || url.startsWith('about:blank#')
}

function parseWindowOpenSize(features: string) {
  const out: { width?: number; height?: number } = {}
  const normalized = features.trim()
  if (!normalized) return out
  for (const raw of normalized.split(',')) {
    const [key, value] = raw.split('=').map((s) => s.trim().toLowerCase())
    const n = Number.parseInt(value ?? '', 10)
    if (!Number.isFinite(n)) continue
    if (key === 'width') out.width = Math.min(10000, Math.max(200, n))
    if (key === 'height') out.height = Math.min(10000, Math.max(200, n))
  }
  return out
}

export function attachNavigationGuards(args: {
  webContents: WebContents
  allowedOrigins: ValueOrGetter<string[]>
  externalLinksPolicy: ValueOrGetter<ExternalLinksPolicy>
  partition: string
  logger: Logger
}) {
  const { webContents, allowedOrigins, externalLinksPolicy, partition, logger } = args

  const getParentWindow = () => BrowserWindow.fromWebContents(webContents) ?? null
  const getAllowedOrigins = typeof allowedOrigins === 'function' ? allowedOrigins : () => allowedOrigins
  const getExternalLinksPolicy =
    typeof externalLinksPolicy === 'function' ? externalLinksPolicy : () => externalLinksPolicy

  const USER_GESTURE_WINDOW_MS = 5000
  let lastUserGestureAt = 0

  webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    lastUserGestureAt = Date.now()
  })

  webContents.on('before-mouse-event', (_event, mouse) => {
    if (mouse.type !== 'mouseDown') return
    lastUserGestureAt = Date.now()
  })

  webContents.on('did-create-window', (childWindow, details) => {
    if (isAboutBlank(details.url)) {
      childWindow.webContents.once('did-navigate', (_event, nextUrl) => {
        if (childWindow.isDestroyed()) return
        if (isAboutBlank(nextUrl)) return
        const d = decideNavigation(nextUrl, getAllowedOrigins())
        if (d.allowed) {
          const parent = getParentWindow()
          if (parent && !webContents.isDestroyed()) void webContents.loadURL(nextUrl)
          if (!childWindow.isDestroyed()) childWindow.close()
        } else {
          childWindow.show()
        }
      })
    } else {
      // 非 about:blank 的窗口仅在确定为外链时才展示
      // 允许域名会被内联到主视图
      // -> 下面的 decision 逻辑会处理是否展示
    }
    childWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
      void childWindow.webContents.loadURL(nextUrl)
      return { action: 'deny' }
    })

    const decision = decideNavigation(details.url, getAllowedOrigins())
    if (decision.allowed) {
      // 若子窗口直指向被允许的源，则不使用弹窗，改为在主视图内加载
      const parent = getParentWindow()
      if (!childWindow.isDestroyed()) childWindow.hide()
      if (parent && !webContents.isDestroyed()) void webContents.loadURL(details.url)
      if (!childWindow.isDestroyed()) childWindow.close()
      return
    }
    // 外链：按策略决定是否展示弹窗
    childWindow.once('ready-to-show', () => childWindow.show())
    if (getExternalLinksPolicy() !== 'open-in-popup') return

    attachPopupReturnTo({
      popup: childWindow,
      parentWindow: getParentWindow(),
      returnTo: webContents,
      allowedOrigins: getAllowedOrigins()
    })
  })

  webContents.on('will-navigate', async (event, url) => {
    const decision = decideNavigation(url, getAllowedOrigins())
    if (decision.allowed) return
    event.preventDefault()
    logger.warn('navigation.blocked', { url, reason: decision.reason })
    const policy = getExternalLinksPolicy()
    // 放宽 will-navigate 的用户手势限制：登录/SSO 常见场景可能是脚本触发
    await handleExternalLink(policy, url, {
      partition,
      parentWindow: getParentWindow(),
      returnTo: { webContents, allowedOrigins: getAllowedOrigins() }
    })
  })

  webContents.on('will-redirect', async (event, url, _isInPlace, isMainFrame) => {
    if (isMainFrame === false) return
    const decision = decideNavigation(url, getAllowedOrigins())
    if (decision.allowed) return
    event.preventDefault()
    logger.warn('navigation.redirectBlocked', { url, reason: decision.reason })
    const policy = getExternalLinksPolicy()
    // 放宽 will-redirect 的用户手势限制：兼容站点自动跳转到第三方登录域名
    await handleExternalLink(policy, url, {
      partition,
      parentWindow: getParentWindow(),
      returnTo: { webContents, allowedOrigins: getAllowedOrigins() }
    })
  })

  webContents.setWindowOpenHandler(({ url, features, disposition, postBody }) => {
    const decision = decideNavigation(url, getAllowedOrigins())
    if (decision.allowed) {
      if (isHttpUrl(url)) void webContents.loadURL(url)
      logger.warn('windowopen.inplace', { url })
      return { action: 'deny' }
    }

    const policy = getExternalLinksPolicy()
    if (policy === 'open-in-popup') {
      if (!isHttpUrl(url) && !isAboutBlank(url)) {
        logger.warn('windowopen.unsupportedUrl', { url })
        return { action: 'deny' }
      }
      const now = Date.now()
      const hasRecentUserGesture = Boolean(postBody) || now - lastUserGestureAt <= USER_GESTURE_WINDOW_MS
      if (!hasRecentUserGesture) {
        logger.warn('windowopen.blockedNoUserGesture', { url, disposition, reason: decision.reason })
        // 兼容部分站点用脚本触发 window.open 的登录/OAuth 场景
        void handleExternalLink(policy, url, {
          partition,
          parentWindow: getParentWindow(),
          returnTo: { webContents, allowedOrigins: getAllowedOrigins() }
        })
        return { action: 'deny' }
      }
      const { width, height } = parseWindowOpenSize(features)
      logger.warn('windowopen.popup', { url, reason: decision.reason })
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
          parent: getParentWindow() ?? undefined,
          modal: false,
          show: false,
          webPreferences: createSafeWebPreferences(undefined, partition)
        }
      }
    }

    logger.warn('windowopen.blocked', { url, reason: decision.reason })
    void handleExternalLink(policy, url, {
      partition,
      parentWindow: getParentWindow(),
      returnTo: { webContents, allowedOrigins: getAllowedOrigins() }
    })
    return { action: 'deny' }
  })
}
