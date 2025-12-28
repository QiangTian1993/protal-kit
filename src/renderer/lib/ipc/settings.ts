import { invoke } from './request'

export async function openSettingsWindow() {
  return invoke<{ opened: boolean }>('app.settings.open', {})
}

export async function closeSettingsWindow() {
  return invoke<{ closed: boolean }>('app.settings.close', {})
}
