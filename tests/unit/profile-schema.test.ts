import { describe, expect, it } from 'vitest'
import { webAppProfileSchema } from '../../src/shared/schemas/profile'

describe('webAppProfileSchema', () => {
  it('accepts a valid minimal profile', () => {
    const now = new Date().toISOString()
    const profile = {
      id: 'p1',
      name: 'App A',
      startUrl: 'https://example.com',
      allowedOrigins: ['https://example.com'],
      isolation: { partition: 'persist:p1' },
      externalLinks: { policy: 'open-in-system' },
      createdAt: now,
      updatedAt: now
    }
    expect(webAppProfileSchema.parse(profile)).toEqual({ ...profile, pinned: true, temporary: false })
  })

  it('rejects invalid startUrl', () => {
    const now = new Date().toISOString()
    expect(() =>
      webAppProfileSchema.parse({
        id: 'p1',
        name: 'App A',
        startUrl: 'notaurl',
        allowedOrigins: ['https://example.com'],
        isolation: { partition: 'persist:p1' },
        externalLinks: { policy: 'open-in-system' },
        createdAt: now,
        updatedAt: now
      })
    ).toThrow()
  })
})
