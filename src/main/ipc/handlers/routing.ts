import type { IpcMain } from 'electron'
import type { IpcContext } from '../router'
import { z } from 'zod'

const requestIdSchema = z.string().min(1)

const getRulesPayloadSchema = z.object({
  requestId: requestIdSchema
})

const addRulePayloadSchema = z.object({
  requestId: requestIdSchema,
  pattern: z.string().min(1),
  patternType: z.enum(['domain', 'prefix', 'regex']),
  profileId: z.string().min(1)
})

const removeRulePayloadSchema = z.object({
  requestId: requestIdSchema,
  ruleId: z.string().min(1)
})

const testUrlPayloadSchema = z.object({
  requestId: requestIdSchema,
  url: z.string().min(1)
})

const promptResultPayloadSchema = z.object({
  requestId: requestIdSchema,
  url: z.string().min(1),
  profileId: z.string().nullable()
})

export function registerRoutingHandlers(ipc: IpcMain, ctx: IpcContext) {
  // 获取所有路由规则
  ipc.handle('routing:getRules', async (_event, payload: unknown) => {
    const { requestId } = getRulesPayloadSchema.parse(payload)
    try {
      const rules = await ctx.linkRouter.getRules()
      return { requestId, result: rules }
    } catch (err) {
      ctx.logger.error('ipc.routing.getRules', { error: String(err) })
      throw err
    }
  })

  // 添加路由规则
  ipc.handle('routing:addRule', async (_event, payload: unknown) => {
    const parsed = addRulePayloadSchema.parse(payload)
    try {
      const rule = await ctx.linkRouter.addRule({
        pattern: parsed.pattern,
        patternType: parsed.patternType,
        profileId: parsed.profileId
      })
      return { requestId: parsed.requestId, result: rule }
    } catch (err) {
      ctx.logger.error('ipc.routing.addRule', { error: String(err) })
      throw err
    }
  })

  // 删除路由规则
  ipc.handle('routing:removeRule', async (_event, payload: unknown) => {
    const parsed = removeRulePayloadSchema.parse(payload)
    try {
      const removed = await ctx.linkRouter.removeRule(parsed.ruleId)
      return { requestId: parsed.requestId, result: removed }
    } catch (err) {
      ctx.logger.error('ipc.routing.removeRule', { error: String(err) })
      throw err
    }
  })

  // 测试 URL 匹配
  ipc.handle('routing:testUrl', async (_event, payload: unknown) => {
    const parsed = testUrlPayloadSchema.parse(payload)
    try {
      const match = await ctx.linkRouter.getRouteForUrl(parsed.url)
      return { requestId: parsed.requestId, result: match }
    } catch (err) {
      ctx.logger.error('ipc.routing.testUrl', { error: String(err) })
      throw err
    }
  })

  // 处理提示结果
  ipc.handle('routing:promptResult', async (_event, payload: unknown) => {
    const parsed = promptResultPayloadSchema.parse(payload)
    try {
      if (parsed.profileId) {
        // 使用新方法直接打开应用并加载 URL
        await ctx.webapps.openProfileWithUrl(parsed.profileId, parsed.url)
      }
      return { requestId: parsed.requestId, result: { success: true } }
    } catch (err) {
      ctx.logger.error('ipc.routing.promptResult', { error: String(err) })
      throw err
    }
  })
}
