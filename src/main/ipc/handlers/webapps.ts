import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'

export function registerWebAppsHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle(
    'webapps.reload',
    async (_event, payload: { requestId: string; profileId: string; ignoreCache?: boolean }) => {
      await ctx.webapps.reloadProfile(payload.profileId, { ignoreCache: payload.ignoreCache })
      return { requestId: payload.requestId, result: { reloaded: true } }
    }
  )

  ipc.handle('webapps.goBack', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.goBack(payload.profileId)
    return { requestId: payload.requestId, result: { navigated: true } }
  })

  ipc.handle('webapps.goForward', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.goForward(payload.profileId)
    return { requestId: payload.requestId, result: { navigated: true } }
  })

  ipc.handle('webapps.hideActiveView', async (_event, payload: { requestId: string }) => {
    ctx.webapps.hideActiveView()
    return { requestId: payload.requestId, result: { hidden: true } }
  })

  ipc.handle('webapps.showActiveView', async (_event, payload: { requestId: string }) => {
    ctx.webapps.showActiveView()
    return { requestId: payload.requestId, result: { shown: true } }
  })

  ipc.handle('webapps.hibernate', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.hibernateProfile(payload.profileId)
    return { requestId: payload.requestId, result: { hibernated: true } }
  })

  ipc.handle('webapps.restore', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.restoreProfile(payload.profileId)
    return { requestId: payload.requestId, result: { restored: true } }
  })
}

