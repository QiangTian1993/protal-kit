import { invoke } from './request'

export async function reloadProfile(profileId: string) {
  await invoke('webapps.reload', { profileId })
}

