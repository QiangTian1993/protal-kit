import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceStore } from '../../src/main/storage/workspace-store'

describe('WorkspaceStore', () => {
  it('persists and reloads workspace snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'portal-kit-'))
    const path = join(dir, 'workspace.json')
    const store = new WorkspaceStore(path)

    const ws = {
      schemaVersion: 1 as const,
      openProfileIds: ['a', 'b'],
      activeProfileId: 'b',
      perProfileState: { b: { lastUrl: 'https://example.com' } },
      updatedAt: new Date().toISOString()
    }
    await store.save(ws)
    const loaded = await store.load()
    expect(loaded.activeProfileId).toBe('b')
    expect(loaded.perProfileState.b.lastUrl).toBe('https://example.com')
  })
})

