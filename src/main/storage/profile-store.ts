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
    // 过滤掉临时应用，不持久化
    return file.profiles
      .filter(profile => !profile.temporary)
      .map((profile) => webAppProfileSchema.parse(profile))
  }

  async listAll(): Promise<WebAppProfile[]> {
    // 包含临时应用的完整列表（用于内存管理）
    const file = (await readJsonFile<ProfilesFile>(this.path)) ?? emptyFile
    return file.profiles.map((profile) => webAppProfileSchema.parse(profile))
  }

  async create(input: WebAppProfileInput): Promise<WebAppProfile> {
    const now = new Date().toISOString()
    const validated = webAppProfileInputSchema.parse(input)
    const profiles = await this.listAll() // 使用 listAll 获取包含临时应用的列表
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

    // 如果是临时应用，不写入文件
    if (profile.temporary) {
      return profile
    }

    const next = [...profiles.filter(p => !p.temporary), profile] // 只保存非临时应用
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: next })
    return profile
  }

  async update(profileId: string, patch: Partial<WebAppProfileInput>): Promise<WebAppProfile> {
    // 先尝试从持久化列表中查找
    let profiles = await this.list()
    let idx = profiles.findIndex((p) => p.id === profileId)

    // 如果没找到，可能是临时应用，从完整列表中查找
    if (idx === -1) {
      profiles = await this.listAll()
      idx = profiles.findIndex((p) => p.id === profileId)
    }

    if (idx === -1) throw new Error(`profile_not_found:${profileId}`)

    const now = new Date().toISOString()
    const nextCandidate = { ...profiles[idx], ...patch, updatedAt: now }
    const next = webAppProfileSchema.parse({
      ...nextCandidate,
      allowedOrigins: normalizeAllowedOrigins(nextCandidate.startUrl, nextCandidate.allowedOrigins)
    })

    // 如果是临时应用转为正式应用，需要持久化
    if (profiles[idx].temporary && !next.temporary) {
      const persistedProfiles = await this.list()
      const out = [...persistedProfiles, next]
      await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out })
      return next
    }

    // 正常更新
    const out = [...profiles.filter(p => !p.temporary)]
    out[idx] = next
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out })
    return next
  }

  async batchUpdate(items: Array<{ profileId: string; patch: Partial<WebAppProfileInput> }>): Promise<WebAppProfile[]> {
    if (items.length === 0) return this.list()

    // 获取所有应用（包括临时应用）
    const allProfiles = await this.listAll()
    const now = new Date().toISOString()
    const patchById = new Map(items.map((item) => [item.profileId, item.patch]))
    let updated = false

    const updatedProfiles = allProfiles.map((profile) => {
      const patch = patchById.get(profile.id)
      if (!patch) return profile
      updated = true
      const nextCandidate = { ...profile, ...patch, updatedAt: now }
      return webAppProfileSchema.parse({
        ...nextCandidate,
        allowedOrigins: normalizeAllowedOrigins(nextCandidate.startUrl, nextCandidate.allowedOrigins)
      })
    })

    if (!updated) return await this.list()

    // 只保存非临时应用
    const out = updatedProfiles.filter(p => !p.temporary)
    await writeJsonFileAtomic(this.path, { schemaVersion: 1, profiles: out })

    return updatedProfiles
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
