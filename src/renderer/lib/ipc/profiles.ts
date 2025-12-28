import type { WebAppProfile, WebAppProfileInput } from '../../../shared/types'
import { invoke } from './request'

export async function listProfiles() {
  const res = await invoke<{ result: { profiles: WebAppProfile[] } }>('profiles.list', {})
  return res.result.profiles
}

export async function createProfile(profile: WebAppProfileInput) {
  const res = await invoke<{ result: { profile: WebAppProfile } }>('profiles.create', { profile })
  return res.result.profile
}

export async function updateProfile(profileId: string, patch: Partial<WebAppProfileInput>) {
  const res = await invoke<{ result: { profile: WebAppProfile } }>('profiles.update', { profileId, patch })
  return res.result.profile
}

export async function deleteProfile(profileId: string) {
  await invoke('profiles.delete', { profileId })
}

export async function batchUpdateProfiles(items: Array<{ profileId: string; patch: Partial<WebAppProfileInput> }>) {
  await invoke('profiles.batchUpdate', { items })
}
