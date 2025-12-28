import type { WebPreferences } from 'electron'

export function createSafeWebPreferences(preloadPath?: string, partition?: string): WebPreferences {
  return {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
    preload: preloadPath,
    partition
  }
}

