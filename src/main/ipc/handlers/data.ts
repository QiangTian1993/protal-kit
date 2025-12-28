import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'
import { clearData } from '../../data/clear-data'

export function registerDataHandlers(ipc: IpcMain, ctx: IpcContext) {
  ipc.handle(
    'data.clear',
    async (_event, payload: { requestId: string; scope: 'profile' | 'all'; profileId?: string }) => {
      await clearData({ scope: payload.scope, profileId: payload.profileId, profiles: ctx.profiles })
      ctx.logger.info('data.clear', { scope: payload.scope, profileId: payload.profileId })
      return { requestId: payload.requestId, result: { cleared: true } }
    }
  )
}

