import type { WebAppProfile } from '../../shared/types'

export type MatchRange = { start: number; end: number }

export type FuzzySearchResult = {
  profile: WebAppProfile
  score: number
  matches: {
    name: MatchRange[]
    startUrl: MatchRange[]
    group: MatchRange[]
  }
}

/**
 * 模糊搜索算法
 * 支持：精确匹配、模糊匹配、拼音首字母
 *
 * 返回结果包含匹配范围，用于 UI 高亮。
 */
export function fuzzySearch(profiles: WebAppProfile[], query: string): FuzzySearchResult[] {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return []

  const results: FuzzySearchResult[] = []

  for (const profile of profiles) {
    const name = profile.name
    const startUrl = profile.startUrl
    const group = profile.group ?? ''

    const nameLower = name.toLowerCase()
    const urlLower = startUrl.toLowerCase()
    const groupLower = group.toLowerCase()

    let score = 0

    // 1. 精确/包含匹配（高优先级）
    const nameSubstringIndex = nameLower.indexOf(normalizedQuery)
    if (nameSubstringIndex === 0 && nameLower.length === normalizedQuery.length) {
      score += 1000
    } else if (nameSubstringIndex >= 0) {
      score += 500
    }

    const urlSubstringIndex = urlLower.indexOf(normalizedQuery)
    if (urlSubstringIndex >= 0) score += 300

    const groupSubstringIndex = groupLower.indexOf(normalizedQuery)
    if (groupSubstringIndex >= 0) score += 200

    // 2. 模糊匹配（子序列）
    const nameSubsequence = matchSubsequence(nameLower, normalizedQuery)
    if (nameSubsequence) score += nameSubsequence.score

    // 3. 首字母匹配
    score += calculateInitialsScore(nameLower, normalizedQuery)

    if (score <= 0) continue

    results.push({
      profile,
      score,
      matches: {
        name:
          nameSubstringIndex >= 0
            ? [{ start: nameSubstringIndex, end: nameSubstringIndex + normalizedQuery.length }]
            : nameSubsequence
              ? indicesToRanges(nameSubsequence.indices)
              : [],
        startUrl:
          urlSubstringIndex >= 0
            ? [{ start: urlSubstringIndex, end: urlSubstringIndex + normalizedQuery.length }]
            : computeSubsequenceRanges(urlLower, normalizedQuery),
        group: group
          ? groupSubstringIndex >= 0
            ? [{ start: groupSubstringIndex, end: groupSubstringIndex + normalizedQuery.length }]
            : computeSubsequenceRanges(groupLower, normalizedQuery)
          : []
      }
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

export function fuzzySearchProfiles(profiles: WebAppProfile[], query: string): WebAppProfile[] {
  return fuzzySearch(profiles, query).map((r) => r.profile)
}

/**
 * 计算文本与 query 的高亮范围（连续子串优先；否则子序列高亮）。
 * - 若无法定位，则返回空数组。
 */
export function computeMatchRanges(text: string, query: string): MatchRange[] {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return []
  const textLower = text.toLowerCase()

  const substringIndex = textLower.indexOf(normalizedQuery)
  if (substringIndex >= 0) {
    return [{ start: substringIndex, end: substringIndex + normalizedQuery.length }]
  }

  return computeSubsequenceRanges(textLower, normalizedQuery)
}

function computeSubsequenceRanges(textLower: string, queryLower: string): MatchRange[] {
  const subsequence = matchSubsequence(textLower, queryLower)
  if (!subsequence) return []
  return indicesToRanges(subsequence.indices)
}

/**
 * 计算模糊匹配分数 + 命中索引（子序列）。
 * 例如：query="gh" 可以匹配 "GitHub"
 */
function matchSubsequence(text: string, query: string): { score: number; indices: number[] } | null {
  let score = 0
  let queryIndex = 0
  let consecutiveMatches = 0
  const indices: number[] = []

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      consecutiveMatches++
      score += 10 + consecutiveMatches * 5
      indices.push(i)
      queryIndex++
    } else {
      consecutiveMatches = 0
    }
  }

  return queryIndex === query.length ? { score, indices } : null
}

function indicesToRanges(indices: number[]): MatchRange[] {
  if (indices.length === 0) return []

  const out: MatchRange[] = []
  let start = indices[0]
  let prev = indices[0]

  for (let i = 1; i < indices.length; i++) {
    const current = indices[i]
    if (current === prev + 1) {
      prev = current
      continue
    }
    out.push({ start, end: prev + 1 })
    start = current
    prev = current
  }

  out.push({ start, end: prev + 1 })
  return out
}

/**
 * 计算首字母匹配分数
 * 例如：query="gh" 可以匹配 "Git Hub"
 */
function calculateInitialsScore(text: string, query: string): number {
  // 提取首字母
  const words = text.split(/[\s\-_]+/).filter((w) => w.length > 0)
  const initials = words.map((w) => w[0]).join('').toLowerCase()

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
