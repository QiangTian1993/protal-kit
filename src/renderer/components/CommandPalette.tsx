import React, { useState, useMemo, useEffect, useRef } from 'react'
import type { WebAppProfile } from '../../shared/types'
import { SearchInput } from './SearchInput'
import { fuzzySearch } from '../utils/fuzzySearch'
import { switchProfile } from '../lib/ipc/workspace'
import { hideActiveView, showActiveView } from '../lib/ipc/webapps'

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
}

export function CommandPalette({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  recentProfileIds = []
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const resultsRef = useRef<HTMLDivElement>(null)

  // 搜索结果
  const filteredProfiles = useMemo(() => {
    if (!query.trim()) {
      // 显示最近使用
      return recentProfileIds
        .map(id => profiles.find(p => p.id === id))
        .filter((p): p is WebAppProfile => p !== undefined)
        .slice(0, 10)
    }

    // 模糊搜索
    return fuzzySearch(profiles, query).slice(0, 20)
  }, [profiles, query, recentProfileIds])

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
  }, [query, filteredProfiles])

  // 滚动到选中项
  useEffect(() => {
    if (!resultsRef.current) return

    const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [selectedIndex])

  // 选择应用
  const handleSelect = React.useCallback((profile: WebAppProfile) => {
    void switchProfile(profile.id)
    onClose()
    setQuery('')
  }, [onClose])

  // 键盘导航
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredProfiles.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const selected = filteredProfiles[selectedIndex]
        if (selected) {
          handleSelect(selected)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredProfiles, onClose, handleSelect])

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
            placeholder="搜索应用..."
            autoFocus
            onEscape={onClose}
          />
        </div>

        <div className="commandPaletteResults" ref={resultsRef}>
          {filteredProfiles.length === 0 ? (
            <div className="commandPaletteEmpty">
              {query.trim() ? '未找到匹配的应用' : '暂无最近使用的应用'}
            </div>
          ) : (
            filteredProfiles.map((profile, index) => (
              <CommandPaletteItem
                key={profile.id}
                profile={profile}
                isSelected={index === selectedIndex}
                isActive={profile.id === activeProfileId}
                onClick={() => handleSelect(profile)}
                onMouseEnter={() => setSelectedIndex(index)}
              />
            ))
          )}
        </div>

        {!query.trim() && filteredProfiles.length > 0 && (
          <div className="commandPaletteFooter">
            <span className="textMuted">最近使用</span>
          </div>
        )}
      </div>
    </div>
  )
}

interface CommandPaletteItemProps {
  profile: WebAppProfile
  isSelected: boolean
  isActive: boolean
  onClick: () => void
  onMouseEnter: () => void
}

function CommandPaletteItem({
  profile,
  isSelected,
  isActive,
  onClick,
  onMouseEnter
}: CommandPaletteItemProps) {
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
        <div className="commandPaletteItemName">{profile.name}</div>
        <div className="commandPaletteItemUrl">{profile.startUrl}</div>
      </div>
      {isActive && (
        <div className="commandPaletteItemBadge">当前</div>
      )}
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
