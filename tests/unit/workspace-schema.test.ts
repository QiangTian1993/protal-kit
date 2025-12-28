import { describe, expect, it } from 'vitest'
import { workspaceSchema } from '../../src/shared/schemas/workspace'

describe('workspaceSchema', () => {
  it('accepts a minimal workspace', () => {
    const ws = {
      schemaVersion: 1 as const,
      openProfileIds: [],
      perProfileState: {},
      updatedAt: new Date().toISOString()
    }
    expect(workspaceSchema.parse(ws)).toEqual(ws)
  })

  it('rejects invalid schemaVersion', () => {
    expect(() =>
      workspaceSchema.parse({
        schemaVersion: 2,
        openProfileIds: [],
        perProfileState: {},
        updatedAt: new Date().toISOString()
      })
    ).toThrow()
  })
})

