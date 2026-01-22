import { z } from 'zod'

const iconSchema = z.object({
  type: z.enum(['builtin', 'file']),
  value: z.string().min(1)
})

const windowSchema = z
  .object({
    defaultWidth: z.number().min(200).max(10000).optional(),
    defaultHeight: z.number().min(200).max(10000).optional()
  })
  .optional()

const allowedOriginsProfileSchema = z.array(z.string().min(1)).min(1)
const allowedOriginsInputSchema = z.array(z.string().min(1)).default([])

export const webAppProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(128),
  startUrl: z.string().url(),
  allowedOrigins: allowedOriginsProfileSchema,
  icon: iconSchema.optional(),
  group: z.string().min(1).max(64).optional(),
  pinned: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional(),
  window: windowSchema,
  isolation: z.object({
    partition: z.string().min(1)
  }),
  externalLinks: z.object({
    policy: z.enum(['open-in-popup', 'open-in-system', 'block', 'ask'])
  }),
  temporary: z.boolean().optional().default(false), // 标记为临时应用
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const webAppProfileInputSchema = webAppProfileSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true
  })
  .extend({
    id: z.string().min(1).optional(), // id 可选，由 ProfileStore 生成
    allowedOrigins: allowedOriginsInputSchema,
    temporary: z.boolean().optional() // 允许输入 temporary 字段
  })

export const executableSchema = z
  .object({
    path: z.string().min(1, { message: '可执行文件路径不能为空' }).optional(),
    bundleId: z.string().min(1, { message: 'Bundle ID 不能为空' }).optional(),
    appName: z.string().min(1, { message: '应用名称不能为空' }).optional(),
    desktopEntry: z.string().min(1, { message: 'Desktop Entry 不能为空' }).optional()
  })
  .refine((data) => data.path || data.bundleId || data.appName || data.desktopEntry, {
    message: '至少需要提供一种可执行方式'
  })

export const nativeAppProfileSchema = z.object({
  type: z.literal('native'),
  id: z.string().min(1, { message: 'id 不能为空' }),
  name: z
    .string()
    .min(1, { message: '名称不能为空' })
    .max(128, { message: '名称不能超过 128 个字符' }),
  executable: executableSchema,
  launchArgs: z.array(z.string().min(1, { message: '启动参数不能为空' })).optional(),
  workingDirectory: z.string().min(1, { message: '工作目录不能为空' }).optional(),
  icon: iconSchema.optional(),
  group: z
    .string()
    .min(1, { message: '分组不能为空' })
    .max(64, { message: '分组不能超过 64 个字符' })
    .optional(),
  pinned: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional(),
  createdAt: z.string().datetime({ message: 'createdAt 必须是合法的 ISO 日期时间' }),
  updatedAt: z.string().datetime({ message: 'updatedAt 必须是合法的 ISO 日期时间' })
})

export const nativeAppProfileInputSchema = nativeAppProfileSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    id: z.string().min(1, { message: 'id 不能为空' }).optional()
  })

export const webAppProfileSchemaWithType = webAppProfileSchema.extend({
  type: z.literal('web').default('web')
})

export const appProfileSchema = z.discriminatedUnion('type', [
  webAppProfileSchemaWithType,
  nativeAppProfileSchema
])

export type ExecutableConfig = z.infer<typeof executableSchema>
export type NativeAppProfile = z.infer<typeof nativeAppProfileSchema>
export type NativeAppProfileInput = z.infer<typeof nativeAppProfileInputSchema>
export type AppProfile = z.infer<typeof appProfileSchema>

export function normalizeAllowedOrigins(startUrl: string, allowedOrigins: string[]) {
  const origin = new URL(startUrl).origin
  const set = new Set([origin, ...allowedOrigins])
  return [...set]
}
