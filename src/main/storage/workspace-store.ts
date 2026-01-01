import type { Workspace } from '../../shared/types'
import { workspaceSchema } from '../../shared/schemas/workspace'
import { readJsonFile, writeJsonFileAtomic } from './file-store'

const emptyWorkspace: Workspace = {
  schemaVersion: 1,
  openProfileIds: [],
  perProfileState: {},
  updatedAt: new Date(0).toISOString()
}

export class WorkspaceStore {
  private path: string

  constructor(path: string) {
    this.path = path
  }

  async load(): Promise<Workspace> {
    try {
      const file = (await readJsonFile<Workspace>(this.path)) ?? emptyWorkspace
      return workspaceSchema.parse(file)
    } catch (err) {
      console.error('Failed to load workspace, using empty workspace:', err)
      return emptyWorkspace
    }
  }

  async save(workspace: Workspace) {
    const validated = workspaceSchema.parse(workspace)
    await writeJsonFileAtomic(this.path, validated)
  }
}
