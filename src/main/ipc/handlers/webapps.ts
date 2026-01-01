import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'

export function registerWebAppsHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle('webapps.reload', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.reloadProfile(payload.profileId)
    return { requestId: payload.requestId, result: { reloaded: true } }
  })

  ipc.handle('webapps.hideActiveView', async (_event, payload: { requestId: string }) => {
    ctx.webapps.hideActiveView()
    return { requestId: payload.requestId, result: { hidden: true } }
  })

  ipc.handle('webapps.showActiveView', async (_event, payload: { requestId: string }) => {
    ctx.webapps.showActiveView()
    return { requestId: payload.requestId, result: { shown: true } }
  })
}

