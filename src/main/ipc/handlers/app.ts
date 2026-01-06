import type { IpcMain } from 'electron'
import { app, BrowserWindow, dialog, nativeTheme, webContents } from 'electron'
import type { IpcContext } from '../router'
import { languageSchema } from '../../../shared/schemas/app-config'

type ThemeMode = 'system' | 'light' | 'dark'
type LibraryNavigatePayload = { mode: 'edit' | 'reveal'; profileId: string }
type MenuAction =
  | 'about'
  | 'quit'
  | 'reload'
  | 'toggleDevTools'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAndMatchStyle'
  | 'delete'
  | 'selectAll'

function isLibraryNavigatePayload(value: unknown): value is LibraryNavigatePayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    (v.mode === 'edit' || v.mode === 'reveal') &&
    typeof v.profileId === 'string' &&
    v.profileId.trim().length > 0
  )
}

export function registerAppHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle('app.theme.set', async (_event, payload: { requestId: string; mode: ThemeMode }) => {
    nativeTheme.themeSource = payload.mode
    return { requestId: payload.requestId, result: { applied: true, mode: nativeTheme.themeSource } }
  })

  ipc.handle(
    'app.layout.set',
    async (
      _event,
      payload: { requestId: string; sidebarWidth: number; topbarHeight: number; rightInset?: number }
    ) => {
      ctx.webapps.updateLayout({
        sidebarWidth: payload.sidebarWidth,
        topbarHeight: payload.topbarHeight,
        rightInset: payload.rightInset
      })
      ctx.settingsWindow.updateLayout({ topbarHeight: payload.topbarHeight })
      return { requestId: payload.requestId, result: { applied: true } }
    }
  )

  ipc.handle('app.settings.open', async (_event, payload: { requestId: string }) => {
    ctx.settingsWindow.open()
    return { requestId: payload.requestId, result: { opened: true } }
  })

  ipc.handle('app.settings.close', async (_event, payload: { requestId: string }) => {
    ctx.settingsWindow.close()
    return { requestId: payload.requestId, result: { closed: true } }
  })

  ipc.handle(
    'app.settings.navigate',
    async (
      _event,
      payload: { requestId: string; target: string; payload: unknown }
    ) => {
      if (payload.target !== 'library' || !isLibraryNavigatePayload(payload.payload)) {
        ctx.logger.warn('app.settings.navigate.invalidPayload', { payload })
        return { requestId: payload.requestId, result: { navigated: false } }
      }

      ctx.settingsWindow.open()
      ;(ctx.settingsWindow as unknown as { sendToDrawer?: (channel: string, payload: unknown) => void })
        .sendToDrawer?.('ui.library.navigate', payload.payload)
      return { requestId: payload.requestId, result: { navigated: true } }
    }
  )

  ipc.handle('app.sidebar.toggle', async (_event, payload: { requestId: string }) => {
    ctx.notify('ui.sidebar.toggle', {})
    return { requestId: payload.requestId, result: { toggled: true } }
  })

  // App config: language get/set
  ipc.handle('app.config.get', async (_event, payload: { requestId: string }) => {
    const config = await ctx.appConfig.load()
    return { requestId: payload.requestId, result: config }
  })
  ipc.handle(
    'app.config.setLanguage',
    async (_event, payload: { requestId: string; language: typeof languageSchema._type }) => {
      const lang = languageSchema.parse(payload.language)
      const next = await ctx.appConfig.patch({ language: lang, schemaVersion: 1 })
      ctx.notify('ui.language.changed', { language: next.language })
      return { requestId: payload.requestId, result: next }
    }
  )

  ipc.handle(
    'app.menu.action',
    async (_event, payload: { requestId: string; action: MenuAction }) => {
      const activeWc = ctx.webapps.getActiveWebContents()
      const focusedWc = webContents.getFocusedWebContents()
      const target = activeWc ?? focusedWc ?? null

      switch (payload.action) {
        case 'about': {
          const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
          await dialog.showMessageBox(parent ?? undefined, {
            type: 'info',
            title: 'Portal Kit',
            message: 'Portal Kit',
            detail: `版本：${app.getVersion()}`
          })
          return { requestId: payload.requestId, result: { ok: true } }
        }
        case 'quit':
          app.quit()
          return { requestId: payload.requestId, result: { ok: true } }
        case 'reload':
          target?.reload()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'toggleDevTools':
          target?.toggleDevTools()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'undo':
          target?.undo()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'redo':
          target?.redo()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'cut':
          target?.cut()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'copy':
          target?.copy()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'paste':
          target?.paste()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'pasteAndMatchStyle':
          target?.pasteAndMatchStyle()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'delete':
          target?.delete()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
        case 'selectAll':
          target?.selectAll()
          return { requestId: payload.requestId, result: { ok: Boolean(target) } }
      }
    }
  )
}
