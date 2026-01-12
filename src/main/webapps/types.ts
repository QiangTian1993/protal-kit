import type { BrowserView } from 'electron'
import type { WebAppProfile } from '../../shared/types'

export type ManagedView = {
  profile: WebAppProfile
  view: BrowserView
  lastActivatedAt: number
  lastFailedUrl?: string
  showingErrorPage?: boolean
}

