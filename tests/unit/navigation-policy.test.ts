import { describe, expect, it } from 'vitest'
import { decideNavigation } from '../../src/main/policy/navigation-policy'

describe('decideNavigation', () => {
  it('allows urls whose origin is in allowedOrigins', () => {
    const res = decideNavigation('https://example.com/path', ['https://example.com'])
    expect(res.allowed).toBe(true)
  })

  it('blocks urls whose origin is not allowed', () => {
    const res = decideNavigation('https://evil.example/path', ['https://example.com'])
    expect(res.allowed).toBe(false)
    expect(res.reason).toMatch('origin_not_allowed')
  })
})

