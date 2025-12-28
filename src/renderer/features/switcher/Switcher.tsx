import React, { useMemo, useRef, useState } from 'react'
import type { WebAppProfile } from '../../../shared/types'
import { batchUpdateProfiles } from '../../lib/ipc/profiles'
import { switchProfile } from '../../lib/ipc/workspace'
import { computePinnedReorderItems, normalizeProfileGroup, sortPinnedProfiles } from '../../utils/profileReorder'

function getInitials(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
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

function AppIcon(props: { profile: WebAppProfile; loading?: boolean }) {
  const [urlIndex, setUrlIndex] = useState(0)
  const iconUrls = useMemo(() => getIconUrls(props.profile), [props.profile])
  const currentUrl = iconUrls[urlIndex] ?? null
  const allFailed = urlIndex >= iconUrls.length

  if (props.loading) {
    return <span className="spinner" style={{ width: 16, height: 16 }} />
  }

  if (!currentUrl || allFailed) {
    return <span>{getInitials(props.profile.name)}</span>
  }

  return (
    <img
      className="switcherIcon"
      src={currentUrl}
      alt={props.profile.name}
      draggable={false}
      onError={() => setUrlIndex((prev) => prev + 1)}
      loading="lazy"
    />
  )
}

function displayGroupName(group: string) {
  return group || '未分组'
}

interface SwitcherProps {
  profiles: WebAppProfile[]
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
  const pinned = useMemo(() => sortPinnedProfiles(profiles), [profiles])

  const groups = useMemo(() => {
    const map = new Map<string, WebAppProfile[]>()
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
    <div className="switcher" role="tablist" aria-label="应用列表">
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
                className={`switcherButton ${isActive ? 'isActive' : ''} ${isDragOver ? 'isDragOver' : ''} ${isDragging ? 'isDragging' : ''}`}
                draggable={true}
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
                  switchProfile(p.id)
                }}
                title={groupName ? `${p.name} · ${displayGroupName(groupName)}` : p.name}
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
  )
}
