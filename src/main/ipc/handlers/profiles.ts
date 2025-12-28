import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'
import type { WebAppProfileInput } from '../../../shared/types'

export function registerProfilesHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle('profiles.list', async (_event, payload: { requestId: string }) => {
    const profiles = await ctx.profiles.list()
    return { requestId: payload.requestId, result: { profiles } }
  })

  ipc.handle('profiles.create', async (_event, payload: { requestId: string; profile: WebAppProfileInput }) => {
    const profile = await ctx.profiles.create(payload.profile)
    ctx.logger.info('profiles.create', { profileId: profile.id })
    ctx.notify('profiles.changed', { type: 'created', profileId: profile.id })
    return { requestId: payload.requestId, result: { profile } }
  })

  ipc.handle(
    'profiles.update',
    async (_event, payload: { requestId: string; profileId: string; patch: Partial<WebAppProfileInput> }) => {
      const profile = await ctx.profiles.update(payload.profileId, payload.patch)
      ctx.logger.info('profiles.update', { profileId: profile.id })
      ctx.webapps.updateProfile(profile)
      ctx.notify('profiles.changed', { type: 'updated', profileId: profile.id })
      return { requestId: payload.requestId, result: { profile } }
    }
  )

  ipc.handle(
    'profiles.batchUpdate',
    async (
      _event,
      payload: {
        requestId: string
        items: Array<{ profileId: string; patch: Partial<WebAppProfileInput> }>
      }
    ) => {
      const profiles = await ctx.profiles.batchUpdate(payload.items)
      const ids = payload.items.map((i) => i.profileId)
      for (const id of ids) {
        const profile = profiles.find((p) => p.id === id)
        if (profile) ctx.webapps.updateProfile(profile)
      }
      ctx.logger.info('profiles.batchUpdate', { count: payload.items.length })
      ctx.notify('profiles.changed', { type: 'batchUpdated', profileIds: ids })
      return { requestId: payload.requestId, result: { updated: ids.length } }
    }
  )

  ipc.handle('profiles.delete', async (_event, payload: { requestId: string; profileId: string }) => {
    await ctx.profiles.delete(payload.profileId)
    ctx.logger.info('profiles.delete', { profileId: payload.profileId })
    ctx.notify('profiles.changed', { type: 'deleted', profileId: payload.profileId })
    return { requestId: payload.requestId, result: { deleted: true } }
  })

  ipc.handle('profiles.export', async (_event, payload: { requestId: string }) => {
    const profiles = await ctx.profiles.exportProfiles()
    return { requestId: payload.requestId, result: { profiles } }
  })

  ipc.handle('profiles.import', async (_event, payload: { requestId: string; profiles: unknown }) => {
    await ctx.profiles.importProfiles(payload.profiles as any)
    ctx.notify('profiles.changed', { type: 'imported' })
    return { requestId: payload.requestId, result: { imported: true } }
  })
}
