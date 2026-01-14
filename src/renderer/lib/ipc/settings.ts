import { invokeResult } from './request'

export type LibraryNavigateMode = 'edit' | 'reveal'
export type LibraryNavigatePayload = { mode: LibraryNavigateMode; profileId: string }

export async function openSettingsWindow() {
  return invokeResult<{ opened: boolean }>('app.settings.open')
}

export async function closeSettingsWindow() {
  return invokeResult<{ closed: boolean }>('app.settings.close')
}

export async function navigateSettingsToLibrary(payload: LibraryNavigatePayload) {
  return invokeResult<{ navigated: boolean }>('app.settings.navigate', { target: 'library', payload })
}
