import { z } from 'zod'

export const languageSchema = z.enum(['system', 'zh-CN', 'en-US'])

export const routingRuleSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  patternType: z.enum(['domain', 'prefix', 'regex']),
  profileId: z.string().min(1),
  createdAt: z.string().datetime()
})

const windowConfigSchema = z.object({
  initialWidth: z.number().int().min(800).optional(),
  initialHeight: z.number().int().min(600).optional()
})

export const appConfigSchema = z.object({
  schemaVersion: z.literal(1),
  language: languageSchema,
  routingRules: z.array(routingRuleSchema).optional().default([]),
  window: windowConfigSchema.optional()
})

export type AppConfig = z.infer<typeof appConfigSchema>
export type RoutingRule = z.infer<typeof routingRuleSchema>

export const defaultAppConfig: AppConfig = {
  schemaVersion: 1,
  language: 'system',
  routingRules: []
}
