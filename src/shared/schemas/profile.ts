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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export const webAppProfileInputSchema = webAppProfileSchema
  .omit({
    createdAt: true,
    updatedAt: true
  })
  .extend({
    allowedOrigins: allowedOriginsInputSchema
  })

export function normalizeAllowedOrigins(startUrl: string, allowedOrigins: string[]) {
  const origin = new URL(startUrl).origin
  const set = new Set([origin, ...allowedOrigins])
  return [...set]
}
