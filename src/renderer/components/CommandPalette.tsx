import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { WebAppProfile, WebAppProfileInput } from '../../shared/types'
import { SearchInput } from './SearchInput'
import { fuzzySearch, computeMatchRanges, type MatchRange } from '../utils/fuzzySearch'
import { switchProfile } from '../lib/ipc/workspace'
import { hideActiveView, showActiveView } from '../lib/ipc/webapps'
import { createProfile } from '../lib/ipc/profiles'
import { ProfileFormModal } from '../features/library/ProfileForm'
import { IconPlus } from './Icons'

export type CommandDescriptor = {
  id: string
  title: string
  subtitle?: string
  keywords?: string[]
  icon?: React.ReactNode
  run: () => void | Promise<void>
}

type PaletteItem =
  | { type: 'profile'; id: string; profile: WebAppProfile; matches?: { name: MatchRange[]; startUrl: MatchRange[] } }
  | { type: 'command'; id: string; command: CommandDescriptor }
  | { type: 'createProfile'; id: string; query: string }

function defaultProfileInput(): WebAppProfileInput {
  return {
    id: '',
    name: '',
    startUrl: '',
    allowedOrigins: [],
    icon: undefined,
    group: undefined,
    pinned: true,
    isolation: { partition: '' },
    externalLinks: { policy: 'open-in-popup' }
  }
}

function coerceToHttpUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/\s/.test(trimmed)) return null

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+-.]*:\/\//.test(trimmed)
  const looksLikeHost =
    trimmed.includes('.') || trimmed.startsWith('localhost') || /^\d{1,3}(\.\d{1,3}){3}/.test(trimmed)

  if (!hasScheme && !looksLikeHost) return null

  const candidate = hasScheme ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function suggestProfileInputFromQuery(query: string): WebAppProfileInput {
  const base = defaultProfileInput()
  const trimmed = query.trim()
  if (!trimmed) return base

  const url = coerceToHttpUrl(trimmed)
  if (url) {
    const u = new URL(url)
    const hostname = u.hostname.replace(/^www\./i, '')
    return {
      ...base,
      name: hostname || trimmed,
      startUrl: url
    }
  }

  return { ...base, name: trimmed }
}

function toFileUrl(filePath: string) {
  if (filePath.startsWith('file://')) return filePath
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[A-Za-z]:/.test(normalized)) return `file:///${encodeURI(normalized)}`
  return `file://${encodeURI(normalized)}`
}

function getIconUrls(profile: WebAppProfile): string[] {
  const urls: string[] = []

  if (profile.icon?.type === 'file') {
    urls.push(toFileUrl(profile.icon.value))
    return urls
  }

  try {
    const url = new URL(profile.startUrl)
    const domain = url.hostname
    urls.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`)
    urls.push(`${url.origin}/favicon.ico`)
    return urls
  } catch {
    return []
  }
}

function AppIcon({ profile }: { profile: WebAppProfile }) {
  const [urlIndex, setUrlIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const iconUrls = useMemo(() => getIconUrls(profile), [profile])
  const currentUrl = iconUrls[urlIndex] ?? null
  const allFailed = urlIndex >= iconUrls.length

  // 当 profile 改变时重置状态
  useEffect(() => {
    setUrlIndex(0)
    setImageError(false)
  }, [profile.id])

  // 如果没有图标URL或全部失败或图片加载错误，显示首字母
  if (!currentUrl || allFailed || imageError) {
    return (
      <span style={{ position: 'relative', zIndex: 1 }}>
        {getInitials(profile.name)}
      </span>
    )
  }

  return (
    <img
      src={currentUrl}
      alt={profile.name}
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'contain',
        display: 'block',
        zIndex: 1
      }}
      onError={() => {
        // 尝试下一个URL
        if (urlIndex < iconUrls.length - 1) {
          setUrlIndex((prev) => prev + 1)
        } else {
          // 所有URL都失败了，显示首字母
          setImageError(true)
        }
      }}
      onLoad={(e) => {
        // 检查图片是否真实加载成功（非0x0）
        const img = e.currentTarget
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          if (urlIndex < iconUrls.length - 1) {
            setUrlIndex((prev) => prev + 1)
          } else {
            setImageError(true)
          }
        }
      }}
      loading="lazy"
    />
  )
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  profiles: WebAppProfile[]
  activeProfileId: string | null
  recentProfileIds?: string[]
  commands?: CommandDescriptor[]
}

function searchCommands(commands: CommandDescriptor[], query: string): CommandDescriptor[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  return commands
    .map((command) => {
      const title = command.title.toLowerCase()
      const keywords = (command.keywords ?? []).join(' ').toLowerCase()
      const subtitle = (command.subtitle ?? '').toLowerCase()

      let score = 0

      if (title === q) score += 1200
      else if (title.includes(q)) score += 600
      if (keywords.includes(q)) score += 250
      if (subtitle.includes(q)) score += 150

      score += calculateFuzzyScore(title, q)
      score += Math.floor(calculateFuzzyScore(keywords, q) * 0.4)

      return { command, score }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.command)
}

function calculateFuzzyScore(text: string, query: string): number {
  let score = 0
  let queryIndex = 0
  let consecutiveMatches = 0

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      consecutiveMatches++
      score += 10 + consecutiveMatches * 5
      queryIndex++
    } else {
      consecutiveMatches = 0
    }
  }

  return queryIndex === query.length ? score : 0
}

export function CommandPalette({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  recentProfileIds = [],
  commands = []
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const resultsRef = useRef<HTMLDivElement>(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createInitial, setCreateInitial] = useState<WebAppProfileInput>(() => defaultProfileInput())
  const [createAutoSwitch, setCreateAutoSwitch] = useState(true)
  const [createError, setCreateError] = useState<string | null>(null)

  const recentProfiles = useMemo(() => {
    return recentProfileIds
      .map((id) => profiles.find((p) => p.id === id))
      .filter((p): p is WebAppProfile => p !== undefined)
      .slice(0, 10)
  }, [profiles, recentProfileIds])

  const existingGroups = useMemo(() => {
    const set = new Set<string>()
    for (const profile of profiles) {
      const key = (profile.group ?? '').trim()
      if (key) set.add(key)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [profiles])

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim()
    const hasQuery = q.length > 0

    const out: PaletteItem[] = []
    if (!hasQuery) {
      const commandResults = commands.slice(0, 8)
      for (const profile of recentProfiles) {
        out.push({ type: 'profile', id: `profile:${profile.id}`, profile })
      }
      for (const command of commandResults) {
        out.push({ type: 'command', id: `command:${command.id}`, command })
      }
      return out
    }

    const commandResults = searchCommands(commands, q).slice(0, 10)
    const profileResults = fuzzySearch(profiles, q).slice(0, 20)

    if (profileResults.length === 0) {
      out.push({ type: 'createProfile', id: `create:${q}`, query: q })
    }
    for (const command of commandResults) {
      out.push({ type: 'command', id: `command:${command.id}`, command })
    }
    for (const result of profileResults) {
      out.push({
        type: 'profile',
        id: `profile:${result.profile.id}`,
        profile: result.profile,
        matches: { name: result.matches.name, startUrl: result.matches.startUrl }
      })
    }
    return out
  }, [commands, profiles, query, recentProfiles])

  // 打开时隐藏 BrowserView
  useEffect(() => {
    if (isOpen) {
      void hideActiveView()
    } else {
      void showActiveView()
    }
  }, [isOpen])

  // 重置选中索引
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, items])

  // 滚动到选中项
  useEffect(() => {
    if (!resultsRef.current) return
    if (selectedIndex < 0 || selectedIndex >= items.length) return

    const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex, items.length])

  const handleSelect = React.useCallback((item: PaletteItem) => {
    if (item.type === 'profile') {
      void switchProfile(item.profile.id)
      onClose()
      setQuery('')
      return
    }

    if (item.type === 'createProfile') {
      setCreateError(null)
      setCreateAutoSwitch(true)
      setCreateInitial(suggestProfileInputFromQuery(item.query))
      setCreateModalOpen(true)
      return
    }

    const run = item.command.run
    onClose()
    setQuery('')
    setTimeout(() => {
      void Promise.resolve()
        .then(run)
        .catch(() => {})
    }, 0)
  }, [onClose])

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return
    if (createModalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = items[selectedIndex]
        if (selected) handleSelect(selected)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, createModalOpen, selectedIndex, items, onClose, handleSelect])

  // 点击背景关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="commandPaletteBackdrop" onClick={handleBackdropClick}>
      <div className="commandPalette">
        <div className="commandPaletteSearch">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="搜索应用或命令..."
            autoFocus
            onEscape={onClose}
          />
        </div>

        <div className="commandPaletteResults" ref={resultsRef}>
          {items.length === 0 ? (
            <div className="commandPaletteEmpty">
              {query.trim() ? '未找到匹配的应用或命令' : '暂无最近使用的应用'}
            </div>
          ) : (
            items.map((item, index) =>
              item.type === 'profile' ? (
                <CommandPaletteProfileItem
                  key={item.id}
                  profile={item.profile}
                  matches={item.matches}
                  isSelected={index === selectedIndex}
                  isActive={item.profile.id === activeProfileId}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              ) : item.type === 'command' ? (
                <CommandPaletteCommandItem
                  key={item.id}
                  command={item.command}
                  query={query}
                  isSelected={index === selectedIndex}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              ) : (
                <CommandPaletteCreateItem
                  key={item.id}
                  query={item.query}
                  isSelected={index === selectedIndex}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              )
            )
          )}
        </div>

        {!query.trim() && recentProfiles.length > 0 && (
          <div className="commandPaletteFooter">
            <span className="textMuted">最近使用</span>
          </div>
        )}
      </div>

      <ProfileFormModal
        open={createModalOpen}
        title={`创建 Web 应用`}
        initial={createInitial}
        existingGroups={existingGroups}
        extraFields={
          <>
            {createError && (
              <div className="field">
                <div style={{ fontSize: 12, color: 'var(--danger-color)' }}>{createError}</div>
              </div>
            )}
            <div className="field">
              <label className="checkboxRow">
                <input
                  type="checkbox"
                  checked={createAutoSwitch}
                  onChange={(e) => setCreateAutoSwitch(e.target.checked)}
                />
                创建后立即打开
              </label>
            </div>
          </>
        }
        onClose={() => setCreateModalOpen(false)}
        onSubmit={async (input) => {
          setCreateError(null)
          try {
            const id = input.id || crypto.randomUUID()
            const patch: WebAppProfileInput = {
              ...input,
              id,
              isolation: { partition: `persist:${id}` }
            }
            const created = await createProfile(patch)
            if (createAutoSwitch) {
              await switchProfile(created.id)
            }
            setTimeout(() => {
              setQuery('')
              onClose()
            }, 0)
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e)
            setCreateError(message)
            throw e
          }
        }}
      />
    </div>
  )
}

interface CommandPaletteProfileItemProps {
  profile: WebAppProfile
  matches?: { name: MatchRange[]; startUrl: MatchRange[] }
  isSelected: boolean
  isActive: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function CommandPaletteProfileItem({
  profile,
  matches,
  isSelected,
  isActive,
  onClick,
  onMouseEnter
}: CommandPaletteProfileItemProps) {
  return (
    <div
      className={`commandPaletteItem ${isSelected ? 'isSelected' : ''} ${isActive ? 'isActive' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="commandPaletteItemIcon">
        <AppIcon profile={profile} />
      </div>
      <div className="commandPaletteItemContent">
        <div className="commandPaletteItemName">
          <HighlightText text={profile.name} ranges={matches?.name} />
        </div>
        <div className="commandPaletteItemUrl">
          <HighlightText text={profile.startUrl} ranges={matches?.startUrl} />
        </div>
      </div>
      {isActive && (
        <div className="commandPaletteItemBadge">当前</div>
      )}
    </div>
  )
}

interface CommandPaletteCommandItemProps {
  command: CommandDescriptor
  query: string
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function CommandPaletteCommandItem({
  command,
  query,
  isSelected,
  onClick,
  onMouseEnter
}: CommandPaletteCommandItemProps) {
  const q = query.trim()
  const titleRanges = q ? computeMatchRanges(command.title, q) : []
  const subtitleText = command.subtitle ?? '命令'
  const subtitleRanges = q ? computeMatchRanges(subtitleText, q) : []

  return (
    <div
      className={`commandPaletteItem ${isSelected ? 'isSelected' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="commandPaletteItemIcon">
        {command.icon ?? <span style={{ position: 'relative', zIndex: 1 }}>⌘</span>}
      </div>
      <div className="commandPaletteItemContent">
        <div className="commandPaletteItemName">
          <HighlightText text={command.title} ranges={titleRanges} />
        </div>
        <div className="commandPaletteItemUrl">
          <HighlightText text={subtitleText} ranges={subtitleRanges} />
        </div>
      </div>
      <div className="commandPaletteItemTag">命令</div>
    </div>
  )
}

function normalizeRanges(ranges: MatchRange[], maxLength: number): MatchRange[] {
  const valid = ranges
    .map((r) => ({
      start: Math.max(0, Math.min(maxLength, r.start)),
      end: Math.max(0, Math.min(maxLength, r.end))
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const merged: MatchRange[] = []
  for (const r of valid) {
    const last = merged[merged.length - 1]
    if (!last || r.start > last.end) {
      merged.push(r)
      continue
    }
    last.end = Math.max(last.end, r.end)
  }
  return merged
}

function HighlightText({ text, ranges }: { text: string; ranges?: MatchRange[] }) {
  const normalized = normalizeRanges(ranges ?? [], text.length)
  if (normalized.length === 0) return text

  const out: React.ReactNode[] = []
  let cursor = 0
  for (let i = 0; i < normalized.length; i++) {
    const r = normalized[i]
    if (r.start > cursor) {
      out.push(<span key={`t-${i}`}>{text.slice(cursor, r.start)}</span>)
    }
    out.push(
      <mark key={`h-${i}`} className="textHighlight">
        {text.slice(r.start, r.end)}
      </mark>
    )
    cursor = r.end
  }
  if (cursor < text.length) {
    out.push(<span key="t-end">{text.slice(cursor)}</span>)
  }
  return <>{out}</>
}

interface CommandPaletteCreateItemProps {
  query: string
  isSelected: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function CommandPaletteCreateItem({
  query,
  isSelected,
  onClick,
  onMouseEnter
}: CommandPaletteCreateItemProps) {
  return (
    <div
      className={`commandPaletteItem ${isSelected ? 'isSelected' : ''}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="commandPaletteItemIcon">
        <IconPlus width={16} height={16} />
      </div>
      <div className="commandPaletteItemContent">
        <div className="commandPaletteItemName">{`创建应用：${query}`}</div>
        <div className="commandPaletteItemUrl">使用现有表单创建新的 Web 应用</div>
      </div>
      <div className="commandPaletteItemTag">创建</div>
    </div>
  )
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'

  const cleaned = trimmed.replace(/[^\p{L}\p{N}\s]/gu, '')
  if (!cleaned) {
    return trimmed.charAt(0).toUpperCase()
  }

  const parts = cleaned.split(/\s+/).filter(p => p.length > 0)

  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    const word = parts[0]
    return word.length === 1 || /[\p{Script=Han}]/u.test(word.charAt(0))
      ? word.charAt(0).toUpperCase()
      : word.slice(0, 2).toUpperCase()
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}
