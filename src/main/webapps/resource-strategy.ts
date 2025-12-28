import type { ManagedView } from './types'

export function evictLru(args: {
  views: Map<string, ManagedView>
  max: number
  activeProfileId: string | null
}) {
  if (args.views.size <= args.max) return []

  const candidates = [...args.views.entries()]
    .filter(([id]) => id !== args.activeProfileId)
    .sort((a, b) => a[1].lastActivatedAt - b[1].lastActivatedAt)

  const evicted: string[] = []
  while (args.views.size - evicted.length > args.max && candidates.length > 0) {
    const [id] = candidates.shift()!
    evicted.push(id)
  }

  return evicted
}

