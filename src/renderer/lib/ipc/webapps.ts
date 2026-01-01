import { invoke } from './request'

export async function reloadProfile(profileId: string) {
  await invoke('webapps.reload', { profileId })
}

export async function hideActiveView() {
  await invoke('webapps.hideActiveView', {})
}

export async function showActiveView() {
  await invoke('webapps.showActiveView', {})
}

