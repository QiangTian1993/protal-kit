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

export async function hibernateProfile(profileId: string) {
  await invoke('webapps.hibernate', { profileId })
}

export async function restoreProfile(profileId: string) {
  await invoke('webapps.restore', { profileId })
}

export async function openProfileWithUrl(profileId: string, url: string) {
  await invoke('webapps.openWithUrl', { profileId, url })
}

