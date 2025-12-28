import { z } from 'zod'

export const languageSchema = z.enum(['system', 'zh-CN', 'en-US'])

export const appConfigSchema = z.object({
  schemaVersion: z.literal(1),
  language: languageSchema
})

export type AppConfig = z.infer<typeof appConfigSchema>

export const defaultAppConfig: AppConfig = {
  schemaVersion: 1,
  language: 'system'
}

