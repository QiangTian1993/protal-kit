import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react'
import { isNativeAppProfile, isWebAppProfile, type AppProfile } from '../../../shared/types'
import { batchUpdateProfiles, updateProfile } from '../../lib/ipc/profiles'
import { navigateSettingsToLibrary } from '../../lib/ipc/settings'
import { switchProfile } from '../../lib/ipc/workspace'
import { switchToNativeApp } from '../../lib/ipc/native-apps'
import { popupContextMenu, type ContextMenuPopupItem } from '../../lib/ipc/context-menu'
import { computePinnedReorderItems, normalizeProfileGroup, sortPinnedProfiles } from '../../utils/profileReorder'

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'

  // 移除特殊字符，只保留字母、数字、中文、空格
  const cleaned = trimmed.replace(/[^\p{L}\p{N}\s]/gu, '')
  if (!cleaned) {
    // 如果清理后为空，使用原始名称的第一个字符
    return trimmed.charAt(0).toUpperCase()
  }

  const parts = cleaned.split(/\s+/).filter(p => p.length > 0)

  if (parts.length === 0) return '?'
  if (parts.length === 1) {
    // 单个词：取前1-2个字符
    const word = parts[0]
    // 中文或其他多字节字符只取1个
    return word.length === 1 || /[\p{Script=Han}]/u.test(word.charAt(0))
      ? word.charAt(0).toUpperCase()
      : word.slice(0, 2).toUpperCase()
  }

  // 多个词：取前两个词的首字母
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
}

function toFileUrl(filePath: string) {
  if (filePath.startsWith('file://')) return filePath
  const normalized = filePath.replace(/\\/g, '/')
  if (/^[A-Za-z]:/.test(normalized)) return `file:///${encodeURI(normalized)}`
  return `file://${encodeURI(normalized)}`
}

function getIconUrls(profile: AppProfile): string[] {
  const urls: string[] = []

  if (profile.icon?.type === 'file') {
    urls.push(toFileUrl(profile.icon.value))
    return urls
  }

  if (!isWebAppProfile(profile)) return urls

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

function AppIcon(props: { profile: AppProfile; loading?: boolean }) {
  const [urlIndex, setUrlIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  const iconUrls = useMemo(() => getIconUrls(props.profile), [props.profile])
  const currentUrl = iconUrls[urlIndex] ?? null
  const allFailed = urlIndex >= iconUrls.length

  // 当 profile 改变时重置状态
  useEffect(() => {
    setUrlIndex(0)
    setImageError(false)
  }, [props.profile.id])

  if (props.loading) {
    return <span className="spinner" style={{ width: 16, height: 16 }} />
  }

  // 如果没有图标URL或全部失败或图片加载错误，显示首字母
  if (!currentUrl || allFailed || imageError) {
    return <span className="switcherInitials">{getInitials(props.profile.name)}</span>
  }

  return (
    <img
      className="switcherIcon"
      src={currentUrl}
      alt={props.profile.name}
      draggable={false}
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

function displayGroupName(group: string) {
  return group || '未分组'
}

interface SwitcherProps {
  profiles: AppProfile[]
  activeProfileId: string | null
  loadingProfileId?: string | null
  activeGroupKey?: string | null
}

export function Switcher({
  profiles,
  activeProfileId,
  loadingProfileId,
  activeGroupKey = null
}: SwitcherProps) {
  const ignoreClickUntil = useRef(0)
  const switcherRef = useRef<HTMLDivElement>(null)
  const pinned = useMemo(() => sortPinnedProfiles(profiles), [profiles])

  const groups = useMemo(() => {
    const map = new Map<string, AppProfile[]>()
    for (const profile of pinned) {
      const key = normalizeProfileGroup(profile.group)
      const list = map.get(key) ?? []
      list.push(profile)
      map.set(key, list)
    }
    return [...map.entries()].map(([key, items]) => ({ key, name: displayGroupName(key), items }))
  }, [pinned])

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [indicatorTop, setIndicatorTop] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!activeProfileId || !switcherRef.current) {
      setIndicatorTop(null)
      return
    }

    const activeButton = switcherRef.current.querySelector(
      `[data-profile-id="${activeProfileId}"]`
    ) as HTMLElement

    if (activeButton) {
      const containerRect = switcherRef.current.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()
      const relativeTop = buttonRect.top - containerRect.top + buttonRect.height / 2
      setIndicatorTop(relativeTop)
    } else {
      setIndicatorTop(null)
    }
  }, [activeProfileId, groups, activeGroupKey])

  async function handleDrop(sourceId: string, targetId: string) {
    const items = computePinnedReorderItems({ pinned, sourceId, targetId })
    if (items.length === 0) return
    await batchUpdateProfiles(items)
  }

  if (pinned.length === 0) {
    return <span className="mutedText">暂无应用</span>
  }

  const visibleGroups = activeGroupKey === null ? groups : groups.filter((g) => g.key === activeGroupKey)
  if (visibleGroups.length === 0) {
    return <span className="mutedText">该分组暂无固定应用</span>
  }

  return (
    <div className="switcherWrapper">
      {indicatorTop !== null && (
        <div
          className="switcherIndicator"
          style={{ top: `${indicatorTop}px` }}
          aria-hidden="true"
        />
      )}
      <div className="switcher" role="tablist" aria-label="应用列表" ref={switcherRef}>
        {visibleGroups.map((group, groupIndex) => (
          <React.Fragment key={group.key || 'ungrouped'}>
            {activeGroupKey === null && groupIndex > 0 && (
              <div
                className="switcherGroupDivider"
                role="separator"
                aria-label={group.name}
                title={group.name}
              />
            )}
            {group.items.map((p) => {
              const isActive = activeProfileId === p.id
              const isLoading = loadingProfileId === p.id
              const isDragOver = dragOverId === p.id
              const isDragging = draggingId === p.id
              const groupName = normalizeProfileGroup(p.group)

              return (
                <button
                  key={p.id}
                  data-profile-id={p.id}
                  className={`switcherButton ${isActive ? 'isActive' : ''} ${isDragOver ? 'isDragOver' : ''} ${isDragging ? 'isDragging' : ''}`}
                  draggable={true}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (draggingId) return
                    ignoreClickUntil.current = Date.now() + 250

                    const menuItems: ContextMenuPopupItem[] = [
                      { id: 'edit', label: '编辑' },
                      { id: 'revealInLibrary', label: '在库中显示' },
                      { type: 'separator', id: 'sep.1' },
                      { id: 'togglePinned', label: '取消固定' }
                    ]

                    const actions: Record<string, () => void | Promise<void>> = {
                      edit: async () => {
                        await navigateSettingsToLibrary({ mode: 'edit', profileId: p.id })
                      },
                      revealInLibrary: async () => {
                        await navigateSettingsToLibrary({ mode: 'reveal', profileId: p.id })
                      },
                      togglePinned: async () => {
                        await updateProfile(p.id, { pinned: false })
                      }
                    }

                    void popupContextMenu({ position: { x: e.clientX, y: e.clientY }, items: menuItems }).then(
                      (itemId) => {
                        if (!itemId) return
                        const action = actions[itemId]
                        if (!action) return
                        void Promise.resolve()
                          .then(action)
                          .catch(() => {})
                      }
                    )
                  }}
                onDragStart={(e) => {
                  setDraggingId(p.id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', p.id)
                }}
                onDragEnd={() => {
                  setDraggingId(null)
                  setDragOverId(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragOverId !== p.id) setDragOverId(p.id)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const sourceId = draggingId ?? e.dataTransfer.getData('text/plain')
                  if (!sourceId) return
                  ignoreClickUntil.current = Date.now() + 250
                  void handleDrop(sourceId, p.id).finally(() => {
                    setDraggingId(null)
                    setDragOverId(null)
                  })
                }}
                onClick={() => {
                  if (Date.now() < ignoreClickUntil.current) return
                  if (draggingId) return
                  if (isNativeAppProfile(p)) {
                    void switchToNativeApp(p.id)
                    return
                  }
                  void switchProfile(p.id)
                }}
                title={groupName ? `${p.name} · ${displayGroupName(groupName)} · 拖拽排序` : `${p.name} · 拖拽排序`}
                aria-label={`切换到 ${p.name}`}
                aria-selected={isActive}
                role="tab"
              >
                <AppIcon profile={p} loading={isLoading} />
              </button>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
