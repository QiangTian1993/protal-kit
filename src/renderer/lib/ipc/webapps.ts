import { invoke } from './request'

export async function reloadProfile(profileId: string, options?: { ignoreCache?: boolean }) {
  await invoke('webapps.reload', { profileId, ignoreCache: options?.ignoreCache ?? false })
}

export async function goBack(profileId: string) {
  await invoke('webapps.goBack', { profileId })
}

export async function goForward(profileId: string) {
  await invoke('webapps.goForward', { profileId })
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

