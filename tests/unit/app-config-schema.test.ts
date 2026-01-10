import { describe, expect, test } from 'vitest'
import { appConfigSchema, defaultAppConfig } from '../../src/shared/schemas/app-config'

describe('appConfigSchema window.initialSize', () => {
  test('parses without window field (backward compatible)', () => {
    expect(appConfigSchema.parse(defaultAppConfig)).toEqual(defaultAppConfig)
  })

  test('accepts initialWidth only', () => {
    const cfg = appConfigSchema.parse({
      ...defaultAppConfig,
      window: { initialWidth: 1000 }
    })
    expect(cfg.window?.initialWidth).toBe(1000)
    expect(cfg.window?.initialHeight).toBeUndefined()
  })

  test('accepts initialHeight only', () => {
    const cfg = appConfigSchema.parse({
      ...defaultAppConfig,
      window: { initialHeight: 800 }
    })
    expect(cfg.window?.initialWidth).toBeUndefined()
    expect(cfg.window?.initialHeight).toBe(800)
  })

  test('rejects non-integer values', () => {
    expect(() =>
      appConfigSchema.parse({
        ...defaultAppConfig,
        window: { initialWidth: 900.5 }
      })
    ).toThrow()
  })

  test('rejects too-small values', () => {
    expect(() =>
      appConfigSchema.parse({
        ...defaultAppConfig,
        window: { initialWidth: 799 }
      })
    ).toThrow()

    expect(() =>
      appConfigSchema.parse({
        ...defaultAppConfig,
        window: { initialHeight: 599 }
      })
    ).toThrow()
  })
})

