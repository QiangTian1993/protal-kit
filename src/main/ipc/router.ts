import { ipcMain } from 'electron'
import type { ProfileStore } from '../storage/profile-store'
import type { WorkspaceStore } from '../storage/workspace-store'
import { registerProfilesHandlers } from './handlers/profiles'
import { registerWorkspaceHandlers } from './handlers/workspace'
import { registerDataHandlers } from './handlers/data'
import { registerWebAppsHandlers } from './handlers/webapps'
import { registerAppHandlers } from './handlers/app'
import type { WebAppManager } from '../webapps/webapp-manager'
import type { AppConfigStore } from '../storage/app-config-store'
import type { Logger } from '../observability/logger'
import type { SettingsWindowManager } from '../windows/settings-window'

export interface IpcContext {
  profiles: ProfileStore
  workspace: WorkspaceStore
  webapps: WebAppManager
  logger: Logger
  settingsWindow: SettingsWindowManager
  appConfig: AppConfigStore
  notify: (channel: string, payload: unknown) => void
}

export function registerIpcHandlers(ctx: IpcContext) {
  registerAppHandlers(ipcMain, ctx)
  registerProfilesHandlers(ipcMain, ctx)
  registerWorkspaceHandlers(ipcMain, ctx)
  registerDataHandlers(ipcMain, ctx)
  registerWebAppsHandlers(ipcMain, ctx)
}
