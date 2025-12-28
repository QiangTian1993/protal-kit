import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function ensureDataDir() {
  const dir = join(app.getPath('userData'), 'data')
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
