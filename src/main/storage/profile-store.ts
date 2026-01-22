import { randomUUID } from 'node:crypto'
import {
  isNativeAppProfile,
  isWebAppProfile,
  type AppProfile,
  type AppProfileInput,
  type NativeAppProfile,
  type NativeAppProfileInput,
  type WebAppProfile,
  type WebAppProfileInput
} from '../../shared/types'
import {
  appProfileSchema,
  nativeAppProfileInputSchema,
  nativeAppProfileSchema,
  webAppProfileSchemaWithType,
  webAppProfileInputSchema,
  normalizeAllowedOrigins
} from '../../shared/schemas/profile'
import { readJsonFile, writeJsonFileAtomic } from './file-store'

type ProfilesFile = { schemaVersion: 1; profiles: unknown[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function shouldPersistProfile(profile: AppProfile): boolean {
  if (!isWebAppProfile(profile)) return true
  return !profile.temporary
}

function migrateLegacyProfileType(profile: unknown): { migrated: unknown; didMigrate: boolean } {
  if (!isRecord(profile)) return { migrated: profile, didMigrate: false }
  if ('type' in profile) return { migrated: profile, didMigrate: false }
  return { migrated: { ...profile, type: 'web' }, didMigrate: true }
}

export class ProfileStore {
  private path: string

  constructor(path: string) {
    this.path = path
  }

  async list(): Promise<WebAppProfile[]> {
    return await this.listWebAppProfiles()
  }

  async listWebAppProfiles(): Promise<WebAppProfile[]> {
    const profiles = await this.listAllAppProfiles()
    return profiles.filter(isWebAppProfile).filter((profile) => !profile.temporary)
  }

  async listNativeAppProfiles(): Promise<NativeAppProfile[]> {
    const profiles = await this.listAllAppProfiles()
    return profiles.filter(isNativeAppProfile)
  }

  private async listAllAppProfiles(): Promise<AppProfile[]> {
    const rawFile = await readJsonFile<unknown>(this.path)
    if (!rawFile) return []

    if (!isRecord(rawFile)) {
      throw new Error('profiles_file_invalid: 根节点必须为对象')
    }

    const rawProfiles = Array.isArray(rawFile.profiles) ? rawFile.profiles : []
    let didMigrate = false
    const migratedProfiles = rawProfiles.map((profile) => {
      const migrated = migrateLegacyProfileType(profile)
      if (migrated.didMigrate) didMigrate = true
      return migrated.migrated
    })

    const profiles = migratedProfiles.map((profile) => appProfileSchema.parse(profile))

    // 旧数据兼容：如果缺少 type 字段，则补齐 type: 'web' 并写回文件（幂等）喵～
    if (didMigrate) {
      const nextFile: ProfilesFile = { schemaVersion: 1, profiles: migratedProfiles }
      await writeJsonFileAtomic(this.path, nextFile)
    }

    return profiles
  }

  async create(input: WebAppProfileInput): Promise<WebAppProfile> {
    const now = new Date().toISOString()
    const validated = webAppProfileInputSchema.parse(input)
    const profiles = await this.listAllAppProfiles()
    const pinned = validated.pinned ?? true
    const nextOrder =
      pinned && validated.order === undefined
        ? Math.max(0, ...profiles.map((p) => p.order ?? 0)) + 1
        : validated.order

    const profile = webAppProfileSchemaWithType.parse({
      ...validated,
      type: 'web',
      id: validated.id || randomUUID(),
      allowedOrigins: normalizeAllowedOrigins(validated.startUrl, validated.allowedOrigins),
      pinned,
      order: nextOrder,
      createdAt: now,
      updatedAt: now
    })

    // 如果是临时应用，不写入文件
    if (profile.temporary) {
      return profile
    }

    const next = [...profiles.filter(shouldPersistProfile), profile]
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: next })
    return profile
  }

  async createNativeProfile(input: NativeAppProfileInput): Promise<NativeAppProfile> {
    const now = new Date().toISOString()
    const validated = nativeAppProfileInputSchema.parse(input)
    const profiles = await this.listAllAppProfiles()
    const pinned = validated.pinned ?? true
    const nextOrder =
      pinned && validated.order === undefined
        ? Math.max(0, ...profiles.map((p) => p.order ?? 0)) + 1
        : validated.order

    const profile = nativeAppProfileSchema.parse({
      ...validated,
      id: validated.id || randomUUID(),
      pinned,
      order: nextOrder,
      createdAt: now,
      updatedAt: now
    })

    const next = [...profiles.filter(shouldPersistProfile), profile]
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: next })
    return profile
  }

  async createAppProfile(input: AppProfileInput): Promise<AppProfile> {
    if (input.type === 'native') {
      return await this.createNativeProfile(input)
    }
    return await this.create(input)
  }

  async update(profileId: string, patch: Partial<WebAppProfileInput>): Promise<WebAppProfile> {
    const profiles = await this.listAllAppProfiles()
    const idx = profiles.findIndex((p) => p.id === profileId)
    if (idx === -1) throw new Error(`profile_not_found:${profileId}`)
    const existing = profiles[idx]
    if (!existing || !isWebAppProfile(existing)) throw new Error(`profile_not_found:${profileId}`)

    const now = new Date().toISOString()
    const nextCandidate = { ...existing, ...patch, updatedAt: now }
    const next = webAppProfileSchemaWithType.parse({
      ...nextCandidate,
      type: 'web',
      allowedOrigins: normalizeAllowedOrigins(nextCandidate.startUrl, nextCandidate.allowedOrigins)
    })

    const out = [...profiles]
    out[idx] = next
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out.filter(shouldPersistProfile) })
    return next
  }

  async updateNativeProfile(profileId: string, patch: Partial<NativeAppProfileInput>): Promise<NativeAppProfile> {
    const profiles = await this.listAllAppProfiles()
    const idx = profiles.findIndex((p) => p.id === profileId)
    if (idx === -1) throw new Error(`profile_not_found:${profileId}`)
    const existing = profiles[idx]
    if (!existing || !isNativeAppProfile(existing)) throw new Error(`profile_not_found:${profileId}`)

    const now = new Date().toISOString()
    const nextCandidate = { ...existing, ...patch, updatedAt: now, type: 'native' as const }
    const next = nativeAppProfileSchema.parse(nextCandidate)

    const out = [...profiles]
    out[idx] = next
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out.filter(shouldPersistProfile) })
    return next
  }

  async updateAppProfile(profileId: string, patch: Partial<AppProfileInput>): Promise<AppProfile> {
    const profiles = await this.listAllAppProfiles()
    const existing = profiles.find((p) => p.id === profileId)
    if (!existing) throw new Error(`profile_not_found:${profileId}`)
    if (isNativeAppProfile(existing)) return await this.updateNativeProfile(profileId, patch as Partial<NativeAppProfileInput>)
    return await this.update(profileId, patch as Partial<WebAppProfileInput>)
  }

  async batchUpdate(items: Array<{ profileId: string; patch: Partial<WebAppProfileInput> }>): Promise<WebAppProfile[]> {
    if (items.length === 0) return this.list()

    const allProfiles = await this.listAllAppProfiles()
    const now = new Date().toISOString()
    const patchById = new Map(items.map((item) => [item.profileId, item.patch]))
    let updated = false

    const updatedProfiles: AppProfile[] = allProfiles.map((profile) => {
      const patch = patchById.get(profile.id)
      if (!patch) return profile
      if (!isWebAppProfile(profile)) return profile

      updated = true
      const nextCandidate = { ...profile, ...patch, updatedAt: now }
      return webAppProfileSchemaWithType.parse({
        ...nextCandidate,
        type: 'web',
        allowedOrigins: normalizeAllowedOrigins(nextCandidate.startUrl, nextCandidate.allowedOrigins)
      })
    })

    if (!updated) return await this.list()

    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: updatedProfiles.filter(shouldPersistProfile) })

    return updatedProfiles.filter(isWebAppProfile)
  }

  async delete(profileId: string): Promise<void> {
    const profiles = await this.listAllAppProfiles()
    const next = profiles.filter((profile) => profile.id !== profileId).filter(shouldPersistProfile)
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: next })
  }

  async importProfiles(profiles: unknown) {
    if (!Array.isArray(profiles)) throw new Error('profiles_import_invalid: profiles 必须是数组')
    const migrated = profiles.map((profile) => {
      const result = migrateLegacyProfileType(profile)
      return result.migrated
    })

    const validated = migrated.map((profile) => appProfileSchema.parse(profile)).filter(shouldPersistProfile)
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: validated })
  }

  async exportProfiles(): Promise<AppProfile[]> {
    const profiles = await this.listAllAppProfiles()
    return profiles.filter(shouldPersistProfile)
  }
}
