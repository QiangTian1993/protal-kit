export type ExternalLinksPolicy = 'open-in-popup' | 'open-in-system' | 'block' | 'ask'

export type IconRef =
  | { type: 'builtin'; value: string }
  | { type: 'file'; value: string }

export interface WebAppProfile {
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
  createdAt: string
  updatedAt: string
}

export type WebAppProfileInput = Omit<WebAppProfile, 'createdAt' | 'updatedAt'>

export interface WebAppRuntimeState {
  lastUrl?: string
  lastActivatedAt?: string
  notes?: string
}

export interface Workspace {
  schemaVersion: 1
  activeProfileId?: string
  openProfileIds: string[]
  perProfileState: Record<string, WebAppRuntimeState>
  windowBounds?: { x?: number; y?: number; width?: number; height?: number }
  updatedAt: string
}
