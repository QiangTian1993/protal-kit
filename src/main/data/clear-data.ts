import { session } from 'electron'
import type { ProfileStore } from '../storage/profile-store'

export async function clearData(args: {
  scope: 'profile' | 'all'
  profileId?: string
  profiles: ProfileStore
}) {
  if (args.scope === 'profile') {
    if (!args.profileId) throw new Error('profileId_required')
    const profiles = await args.profiles.list()
    const profile = profiles.find((p) => p.id === args.profileId)
    if (!profile) throw new Error(`profile_not_found:${args.profileId}`)
    const s = session.fromPartition(profile.isolation.partition)
    await s.clearStorageData()
    await s.clearCache()
    return
  }

  const profiles = await args.profiles.list()
  await Promise.all(
    profiles.map(async (p) => {
      const s = session.fromPartition(p.isolation.partition)
      await s.clearStorageData()
      await s.clearCache()
    })
  )
}

