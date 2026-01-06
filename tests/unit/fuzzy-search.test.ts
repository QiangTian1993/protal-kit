import { describe, expect, it } from 'vitest'
import type { WebAppProfile } from '../../src/shared/types'
import { computeMatchRanges, fuzzySearch } from '../../src/renderer/utils/fuzzySearch'

function mkProfile(
  partial: Pick<WebAppProfile, 'id' | 'name' | 'startUrl'> & Partial<WebAppProfile>
): WebAppProfile {
  const now = new Date().toISOString()
  const origin = new URL(partial.startUrl).origin
  return {
    id: partial.id,
    name: partial.name,
    startUrl: partial.startUrl,
    allowedOrigins: [origin],
    isolation: { partition: `persist:${partial.id}` },
    externalLinks: { policy: 'open-in-popup' },
    createdAt: now,
    updatedAt: now,
    ...partial
  }
}

describe('computeMatchRanges', () => {
  it('highlights contiguous substring when present', () => {
    expect(computeMatchRanges('GitHub', 'hub')).toEqual([{ start: 3, end: 6 }])
  })

  it('highlights subsequence when not a substring', () => {
    expect(computeMatchRanges('GitHub', 'gh')).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 4 }
    ])
  })

  it('is case-insensitive and trims query', () => {
    expect(computeMatchRanges('GitHub', '  HUB  ')).toEqual([{ start: 3, end: 6 }])
  })

  it('returns empty when no match', () => {
    expect(computeMatchRanges('GitHub', 'zz')).toEqual([])
  })
})

describe('fuzzySearch', () => {
  it('returns sorted results with match ranges for name and startUrl', () => {
    const profiles = [
      mkProfile({
        id: 'p1',
        name: 'GitHub',
        startUrl: 'https://github.com',
        group: 'Work'
      }),
      mkProfile({
        id: 'p2',
        name: 'GitLab',
        startUrl: 'https://gitlab.com'
      })
    ]

    const results = fuzzySearch(profiles, 'hub')
    expect(results[0]?.profile.id).toBe('p1')
    expect(results[0]?.matches.name).toEqual([{ start: 3, end: 6 }])

    const url = profiles[0].startUrl.toLowerCase()
    const idx = url.indexOf('hub')
    expect(results[0]?.matches.startUrl).toEqual([{ start: idx, end: idx + 3 }])
  })
})
