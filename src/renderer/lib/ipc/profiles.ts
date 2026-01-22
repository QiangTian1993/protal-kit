import type { AppProfile, AppProfileInput } from '../../../shared/types'
import { invoke } from './request'

export async function listProfiles() {
  const res = await invoke<{ result: { profiles: AppProfile[] } }>('profiles.list', {})
  return res.result.profiles
}

export async function createProfile(profile: AppProfileInput) {
  const res = await invoke<{ result: { profile: AppProfile } }>('profiles.create', { profile })
  return res.result.profile
}

export async function updateProfile(profileId: string, patch: Partial<AppProfileInput>) {
  const res = await invoke<{ result: { profile: AppProfile } }>('profiles.update', { profileId, patch })
  return res.result.profile
}

export async function deleteProfile(profileId: string) {
  await invoke('profiles.delete', { profileId })
}

export async function batchUpdateProfiles(items: Array<{ profileId: string; patch: Partial<AppProfileInput> }>) {
  for (const item of items) {
    await updateProfile(item.profileId, item.patch)
  }
}
