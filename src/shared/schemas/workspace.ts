import { z } from 'zod'

const runtimeStateSchema = z.object({
  lastUrl: z.string().url().optional(),
  lastActivatedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['active', 'background', 'hibernated']).optional().default('background'),
  hibernatedAt: z.string().datetime().optional(),
  snapshotPath: z.string().optional()
})

export const workspaceSchema = z.object({
  schemaVersion: z.literal(1),
  activeProfileId: z.string().min(1).optional(),
  openProfileIds: z.array(z.string().min(1)),
  perProfileState: z.record(runtimeStateSchema),
  windowBounds: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().min(200).max(10000).optional(),
      height: z.number().min(200).max(10000).optional()
    })
    .optional(),
  updatedAt: z.string().datetime()
})

