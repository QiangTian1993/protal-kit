import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'
import type { RoutingRule } from '../../../shared/schemas/app-config'

export function registerRoutingHandlers(ipc: IpcMain, ctx: IpcContext) {
  // 获取所有路由规则
  ipc.handle('routing:getRules', async () => {
    try {
      return await ctx.linkRouter.getRules()
    } catch (err) {
      ctx.logger.error('ipc.routing.getRules', { error: String(err) })
      throw err
    }
  })

  // 添加路由规则
  ipc.handle('routing:addRule', async (_event, rule: Omit<RoutingRule, 'id' | 'createdAt'>) => {
    try {
      return await ctx.linkRouter.addRule(rule)
    } catch (err) {
      ctx.logger.error('ipc.routing.addRule', { error: String(err) })
      throw err
    }
  })

  // 删除路由规则
  ipc.handle('routing:removeRule', async (_event, ruleId: string) => {
    try {
      return await ctx.linkRouter.removeRule(ruleId)
    } catch (err) {
      ctx.logger.error('ipc.routing.removeRule', { error: String(err) })
      throw err
    }
  })

  // 测试 URL 匹配
  ipc.handle('routing:testUrl', async (_event, url: string) => {
    try {
      return await ctx.linkRouter.getRouteForUrl(url)
    } catch (err) {
      ctx.logger.error('ipc.routing.testUrl', { error: String(err) })
      throw err
    }
  })

  // 处理提示结果
  ipc.handle('routing:promptResult', async (_event, payload: { url: string; profileId: string | null }) => {
    try {
      if (payload.profileId) {
        // 使用新方法直接打开应用并加载 URL
        await (ctx.webapps as any).openProfileWithUrl(payload.profileId, payload.url)
      }
      return { success: true }
    } catch (err) {
      ctx.logger.error('ipc.routing.promptResult', { error: String(err) })
      throw err
    }
  })
}
