import type { WebAppProfile } from '../../shared/types'

interface SearchResult {
  profile: WebAppProfile
  score: number
}

/**
 * 模糊搜索算法
 * 支持：精确匹配、模糊匹配、拼音首字母
 */
export function fuzzySearch(
  profiles: WebAppProfile[],
  query: string
): WebAppProfile[] {
  const normalizedQuery = query.toLowerCase().trim()

  if (!normalizedQuery) {
    return []
  }

  const results: SearchResult[] = profiles
    .map(profile => {
      const name = profile.name.toLowerCase()
      const url = profile.startUrl.toLowerCase()
      const group = (profile.group ?? '').toLowerCase()

      let score = 0

      // 1. 精确匹配（最高优先级）
      if (name === normalizedQuery) {
        score += 1000
      } else if (name.includes(normalizedQuery)) {
        score += 500
      }

      if (url.includes(normalizedQuery)) {
        score += 300
      }

      if (group.includes(normalizedQuery)) {
        score += 200
      }

      // 2. 模糊匹配
      const fuzzyScore = calculateFuzzyScore(name, normalizedQuery)
      score += fuzzyScore

      // 3. 首字母匹配
      const initialsScore = calculateInitialsScore(name, normalizedQuery)
      score += initialsScore

      return { profile, score }
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)

  return results.map(r => r.profile)
}

/**
 * 计算模糊匹配分数
 * 例如：query="gh" 可以匹配 "GitHub"
 */
function calculateFuzzyScore(text: string, query: string): number {
  let score = 0
  let queryIndex = 0
  let consecutiveMatches = 0

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      // 连续匹配加分
      consecutiveMatches++
      score += 10 + consecutiveMatches * 5
      queryIndex++
    } else {
      consecutiveMatches = 0
    }
  }

  // 完全匹配所有字符才给分
  return queryIndex === query.length ? score : 0
}

/**
 * 计算首字母匹配分数
 * 例如：query="gh" 可以匹配 "Git Hub"
 */
function calculateInitialsScore(text: string, query: string): number {
  // 提取首字母
  const words = text.split(/[\s\-_]+/).filter(w => w.length > 0)
  const initials = words.map(w => w[0]).join('').toLowerCase()

  if (initials.includes(query)) {
    return 100
  }

  // 模糊首字母匹配
  let queryIndex = 0
  for (let i = 0; i < initials.length && queryIndex < query.length; i++) {
    if (initials[i] === query[queryIndex]) {
      queryIndex++
    }
  }

  return queryIndex === query.length ? 50 : 0
}
