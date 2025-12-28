import { randomUUID } from 'node:crypto'
import type { WebAppProfile, WebAppProfileInput } from '../../shared/types'
import {
  webAppProfileSchema,
  webAppProfileInputSchema,
  normalizeAllowedOrigins
} from '../../shared/schemas/profile'
import { readJsonFile, writeJsonFileAtomic } from './file-store'

type ProfilesFile = { schemaVersion: 1; profiles: WebAppProfile[] }

const emptyFile: ProfilesFile = { schemaVersion: 1, profiles: [] }

export class ProfileStore {
  private path: string

  constructor(path: string) {
    this.path = path
  }

  async list(): Promise<WebAppProfile[]> {
    const file = (await readJsonFile<ProfilesFile>(this.path)) ?? emptyFile
    return file.profiles.map((profile) => webAppProfileSchema.parse(profile))
  }

  async create(input: WebAppProfileInput): Promise<WebAppProfile> {
    const now = new Date().toISOString()
    const validated = webAppProfileInputSchema.parse(input)
    const profiles = await this.list()
    const pinned = validated.pinned ?? true
    const nextOrder =
      pinned && validated.order === undefined
        ? Math.max(0, ...profiles.map((p) => p.order ?? 0)) + 1
        : validated.order
    const profile: WebAppProfile = webAppProfileSchema.parse({
      ...validated,
      id: validated.id || randomUUID(),
      allowedOrigins: normalizeAllowedOrigins(validated.startUrl, validated.allowedOrigins),
      pinned,
      order: nextOrder,
      createdAt: now,
      updatedAt: now
    })
    const next = [...profiles, profile]
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: next })
    return profile
  }

  async update(profileId: string, patch: Partial<WebAppProfileInput>): Promise<WebAppProfile> {
    const profiles = await this.list()
    const idx = profiles.findIndex((p) => p.id === profileId)
    if (idx === -1) throw new Error(`profile_not_found:${profileId}`)
    const now = new Date().toISOString()
    const nextCandidate = { ...profiles[idx], ...patch, updatedAt: now }
    const next = webAppProfileSchema.parse({
      ...nextCandidate,
      allowedOrigins: normalizeAllowedOrigins(nextCandidate.startUrl, nextCandidate.allowedOrigins)
    })
    const out = [...profiles]
    out[idx] = next
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out })
    return next
  }

  async batchUpdate(items: Array<{ profileId: string; patch: Partial<WebAppProfileInput> }>): Promise<WebAppProfile[]> {
    if (items.length === 0) return this.list()
    const profiles = await this.list()
    const now = new Date().toISOString()
    const patchById = new Map(items.map((item) => [item.profileId, item.patch]))
    let updated = false
    const out = profiles.map((profile) => {
      const patch = patchById.get(profile.id)
      if (!patch) return profile
      updated = true
      const nextCandidate = { ...profile, ...patch, updatedAt: now }
      return webAppProfileSchema.parse({
        ...nextCandidate,
        allowedOrigins: normalizeAllowedOrigins(nextCandidate.startUrl, nextCandidate.allowedOrigins)
      })
    })
    if (!updated) return profiles
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out })
    return out
  }

  async delete(profileId: string): Promise<void> {
    const profiles = await this.list()
    const next = profiles.filter((p) => p.id !== profileId)
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: next })
  }

  async importProfiles(profiles: WebAppProfile[]) {
    const validated = profiles.map((p) => webAppProfileSchema.parse(p))
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: validated })
  }

  async exportProfiles() {
    return this.list()
  }
}
