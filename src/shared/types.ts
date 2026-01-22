export type ExternalLinksPolicy = 'open-in-popup' | 'open-in-system' | 'block' | 'ask'

export type IconRef =
  | { type: 'builtin'; value: string }
  | { type: 'file'; value: string }

export interface WebAppProfile {
  type?: 'web'
  id: string
  name: string
  startUrl: string
  allowedOrigins: string[]
  icon?: IconRef
  group?: string
  pinned?: boolean
  order?: number
  window?: { defaultWidth?: number; defaultHeight?: number }
  isolation: { partition: string }
  externalLinks: { policy: ExternalLinksPolicy }
  temporary?: boolean
  createdAt: string
  updatedAt: string
}

export interface NativeAppProfile {
  type: 'native'
  id: string
  name: string
  executable: { path?: string; bundleId?: string; appName?: string; desktopEntry?: string }
  launchArgs?: string[]
  workingDirectory?: string
  icon?: IconRef
  group?: string
  pinned?: boolean
  order?: number
  createdAt: string
  updatedAt: string
}

export type AppProfile = WebAppProfile | NativeAppProfile

export type WebAppProfileInput = Omit<WebAppProfile, 'createdAt' | 'updatedAt' | 'id'> & {
  id?: string
}

export type NativeAppProfileInput = Omit<NativeAppProfile, 'createdAt' | 'updatedAt' | 'id'> & {
  id?: string
}

export type AppProfileInput = WebAppProfileInput | NativeAppProfileInput

export interface WebAppRuntimeState {
  lastUrl?: string
  lastActivatedAt?: string
  notes?: string
  status?: 'active' | 'background' | 'hibernated'
  hibernatedAt?: string
  snapshotPath?: string
}

export interface Workspace {
  schemaVersion: 1
  activeProfileId?: string
  openProfileIds: string[]
  perProfileState: Record<string, WebAppRuntimeState>
  windowBounds?: { x?: number; y?: number; width?: number; height?: number }
  updatedAt: string
}

export function isWebAppProfile(profile: AppProfile): profile is WebAppProfile {
  return profile.type !== 'native'
}

export function isNativeAppProfile(profile: AppProfile): profile is NativeAppProfile {
  return profile.type === 'native'
}
