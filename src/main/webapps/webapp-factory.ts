import { BrowserView } from 'electron'
import type { WebAppProfile } from '../../shared/types'
import { createSafeWebPreferences } from '../security/web-preferences'

export function createWebAppView(profile: WebAppProfile) {
  const view = new BrowserView({
    webPreferences: createSafeWebPreferences(undefined, profile.isolation.partition)
  })
  const wc = view.webContents as any
  if (typeof wc.setBackgroundColor === 'function') wc.setBackgroundColor('#f2f2f7')

  return view
}
