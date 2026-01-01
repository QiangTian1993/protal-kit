import type { WebAppProfile, WebAppProfileInput } from '../../shared/types'

export function normalizeProfileGroup(value: string | undefined) {
  return (value ?? '').trim()
}

function compareByGroupOrderName(a: WebAppProfile, b: WebAppProfile) {
  const aGroup = normalizeProfileGroup(a.group)
  const bGroup = normalizeProfileGroup(b.group)
  if (aGroup !== bGroup) return aGroup.localeCompare(bGroup)
  const orderDiff = (a.order ?? 0) - (b.order ?? 0)
  if (orderDiff !== 0) return orderDiff
  return a.name.localeCompare(b.name)
}

export function sortPinnedProfiles(profiles: WebAppProfile[]) {
  // 只显示固定应用，不显示临时应用
  return [...profiles]
    .filter((p) => !p.temporary && (p.pinned ?? true))
    .sort(compareByGroupOrderName)
}

export function sortUnpinnedProfiles(profiles: WebAppProfile[]) {
  return [...profiles].filter((p) => !(p.pinned ?? true)).sort(compareByGroupOrderName)
}

export function computeGroupReorderItems(args: {
  profiles: WebAppProfile[]
  sourceId: string
  targetId: string
}): Array<{ profileId: string; patch: Partial<WebAppProfileInput> }> {
  const { profiles, sourceId, targetId } = args
  if (sourceId === targetId) return []

  const source = profiles.find((p) => p.id === sourceId)
  const target = profiles.find((p) => p.id === targetId)
  if (!source || !target) return []

  const sourceGroup = normalizeProfileGroup(source.group)
  const targetGroup = normalizeProfileGroup(target.group)

  const originalById = new Map(profiles.map((p) => [p.id, p]))
  const groupMap = new Map<string, WebAppProfile[]>()
  for (const profile of profiles) {
    const key = normalizeProfileGroup(profile.group)
    const list = groupMap.get(key) ?? []
    list.push(profile)
    groupMap.set(key, list)
  }

  const sourceList = [...(groupMap.get(sourceGroup) ?? [])]
  const targetList = sourceGroup === targetGroup ? sourceList : [...(groupMap.get(targetGroup) ?? [])]
  const movingIndex = sourceList.findIndex((p) => p.id === sourceId)
  const targetIndex = targetList.findIndex((p) => p.id === targetId)
  if (movingIndex === -1 || targetIndex === -1) return []

  const moving = sourceList[movingIndex]!
  sourceList.splice(movingIndex, 1)

  const insertIndex =
    sourceGroup === targetGroup ? (movingIndex < targetIndex ? targetIndex - 1 : targetIndex) : targetIndex
  targetList.splice(insertIndex, 0, moving)

  groupMap.set(sourceGroup, sourceList)
  groupMap.set(targetGroup, targetList)

  const affected = new Set([sourceGroup, targetGroup])
  const items: Array<{ profileId: string; patch: Partial<WebAppProfileInput> }> = []
  for (const groupKey of affected) {
    const list = groupMap.get(groupKey) ?? []
    for (const [idx, profile] of list.entries()) {
      const nextOrder = idx + 1
      const nextGroup = groupKey || undefined
      const original = originalById.get(profile.id)
      if (!original) continue
      const originalGroup = normalizeProfileGroup(original.group) || undefined
      if ((original.order ?? 0) === nextOrder && originalGroup === nextGroup) continue
      items.push({ profileId: profile.id, patch: { order: nextOrder, group: nextGroup } })
    }
  }
  return items
}

export function computePinnedReorderItems(args: {
  pinned: WebAppProfile[]
  sourceId: string
  targetId: string
}): Array<{ profileId: string; patch: Partial<WebAppProfileInput> }> {
  return computeGroupReorderItems({ profiles: args.pinned, sourceId: args.sourceId, targetId: args.targetId })
}
