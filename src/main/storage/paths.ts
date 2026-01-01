import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function ensureDataDir() {
  const dir = join(app.getPath('userData'), 'data')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function ensureSnapshotsDir() {
  const dir = join(app.getPath('userData'), 'snapshots')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function profilesPath() {
  return join(ensureDataDir(), 'profiles.json')
}

export function workspacePath() {
  return join(ensureDataDir(), 'workspace.json')
}

export function appConfigPath() {
  return join(ensureDataDir(), 'app-config.json')
}

export function snapshotPath(profileId: string) {
  return join(ensureSnapshotsDir(), `${profileId}.png`)
}
