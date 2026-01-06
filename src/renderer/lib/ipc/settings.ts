import { invoke } from './request'

export type LibraryNavigateMode = 'edit' | 'reveal'
export type LibraryNavigatePayload = { mode: LibraryNavigateMode; profileId: string }

export async function openSettingsWindow() {
  return invoke<{ opened: boolean }>('app.settings.open', {})
}

export async function closeSettingsWindow() {
  return invoke<{ closed: boolean }>('app.settings.close', {})
}

export async function navigateSettingsToLibrary(payload: LibraryNavigatePayload) {
  return invoke<{ result: { navigated: boolean } }>('app.settings.navigate', { target: 'library', payload })
}
