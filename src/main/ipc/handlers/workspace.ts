import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'

export function registerWorkspaceHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle('workspace.get', async (_event, payload: { requestId: string }) => {
    const workspace = await ctx.workspace.load()
    return { requestId: payload.requestId, result: { workspace } }
  })

  ipc.handle('workspace.open', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.openProfile(payload.profileId)
    return { requestId: payload.requestId, result: { activeProfileId: payload.profileId } }
  })

  ipc.handle('workspace.switch', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.switchToProfile(payload.profileId)
    return { requestId: payload.requestId, result: { activeProfileId: payload.profileId } }
  })

  ipc.handle('workspace.close', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.webapps.closeProfile(payload.profileId)
    return { requestId: payload.requestId, result: { closed: true } }
  })
}

