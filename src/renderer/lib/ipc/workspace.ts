import { invoke } from './request'

export async function getWorkspace() {
  const res = await invoke<{ result: { workspace: any } }>('workspace.get', {})
  return res.result.workspace
}

export async function openProfile(profileId: string) {
  const res = await invoke<{ result: { activeProfileId: string } }>('workspace.open', { profileId })
  return res.result.activeProfileId
}

export async function switchProfile(profileId: string) {
  const res = await invoke<{ result: { activeProfileId: string } }>('workspace.switch', { profileId })
  return res.result.activeProfileId
}

export async function closeProfile(profileId: string) {
  await invoke('workspace.close', { profileId })
}
