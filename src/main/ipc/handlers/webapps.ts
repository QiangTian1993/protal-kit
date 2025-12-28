import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'

export function registerWebAppsHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle('webapps.reload', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.reloadProfile(payload.profileId)
    return { requestId: payload.requestId, result: { reloaded: true } }
  })
}

