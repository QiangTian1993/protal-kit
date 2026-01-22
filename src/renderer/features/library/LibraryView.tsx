import { useEffect, useMemo, useRef, useState } from 'react'
import {
  isNativeAppProfile,
  isWebAppProfile,
  type AppProfile,
  type AppProfileInput,
  type NativeAppProfile,
  type NativeAppProfileInput,
  type WebAppProfileInput
} from '../../../shared/types'
import { batchUpdateProfiles, createProfile, deleteProfile, updateProfile } from '../../lib/ipc/profiles'
import { switchProfile } from '../../lib/ipc/workspace'
import { reloadProfile } from '../../lib/ipc/webapps'
import { listNativeApps, switchToNativeApp, type NativeAppRuntimeState } from '../../lib/ipc/native-apps'
import { ProfileForm } from './ProfileForm'
import { ConfirmDialog } from '../../components/Modal'
import { ImportExport } from './ImportExport'
import {
  computeGroupReorderItems,
  computePinnedReorderItems,
  normalizeProfileGroup,
  sortPinnedProfiles,
  sortUnpinnedProfiles
} from '../../utils/profileReorder'
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconRefresh,
  IconArrowUp,
  IconArrowDown,
  IconPin,
  IconPinOff,
  IconSearch,
  IconExternalLink,
  IconChevronLeft
} from '../../components/Icons'

const defaultInput = (): WebAppProfileInput => ({
  id: undefined,
  name: '',
  startUrl: '',
  allowedOrigins: [],
  icon: undefined,
  group: undefined,
  pinned: true,
  isolation: { partition: 'persist:draft' },
  externalLinks: { policy: 'open-in-popup' }
})

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

function describeNativeExecutable(profile: NativeAppProfile): string {
  const exe = profile.executable
  if (exe.path) return exe.path
  if (exe.bundleId) return `Bundle ID：${exe.bundleId}`
  if (exe.appName) return `应用：${exe.appName}`
  if (exe.desktopEntry) return `Desktop Entry：${exe.desktopEntry}`
  return '未配置启动方式'
}

function describeNativeStatus(state: NativeAppRuntimeState | undefined): string {
  if (!state) return '状态未知'
  if (!state.isRunning) return '未运行'
  const pid = state.processId ? ` · PID ${state.processId}` : ''
  return `运行中${pid}`
}

function ProfileIcon({ profile }: { profile: AppProfile }) {
  const [urlIndex, setUrlIndex] = useState(0)
  const iconUrls = useMemo(() => getIconUrls(profile), [profile])
  const currentUrl = iconUrls[urlIndex] ?? null
  const allFailed = urlIndex >= iconUrls.length

  if (!currentUrl || allFailed) {
    return <span>{getInitials(profile.name)}</span>
  }

  return (
    <img
      src={currentUrl}
      alt=""
      draggable={false}
      onError={() => setUrlIndex((prev) => prev + 1)}
      loading="lazy"
    />
  )
}

function toProfileInput(profile: AppProfile): AppProfileInput {
  if (isNativeAppProfile(profile)) {
    const input: NativeAppProfileInput = {
      type: 'native',
      id: profile.id,
      name: profile.name,
      executable: profile.executable,
      launchArgs: profile.launchArgs,
      workingDirectory: profile.workingDirectory,
      icon: profile.icon,
      group: profile.group,
      pinned: profile.pinned,
      order: profile.order
    }
    return input
  }

  const input: WebAppProfileInput = {
    id: profile.id,
    name: profile.name,
    startUrl: profile.startUrl,
    allowedOrigins: profile.allowedOrigins,
    icon: profile.icon,
    group: profile.group,
    pinned: profile.pinned,
    order: profile.order,
    window: profile.window,
    isolation: profile.isolation,
    externalLinks: profile.externalLinks,
    temporary: profile.temporary
  }
  return input
}

type LibraryScreen = { type: 'list' } | { type: 'create' } | { type: 'edit'; profileId: string }
type LibraryNavigateRequest = { mode: 'edit' | 'reveal'; profileId: string; nonce: string }

export function LibraryView(props: {
  profiles: AppProfile[]
  activeProfileId: string | null
  navigate?: LibraryNavigateRequest
  onChanged: () => void
}) {
  const [screen, setScreen] = useState<LibraryScreen>({ type: 'list' })
  const [deleting, setDeleting] = useState<AppProfile | null>(null)
  const [query, setQuery] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingSection, setDraggingSection] = useState<'pinned' | 'unpinned' | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [revealTarget, setRevealTarget] = useState<{ profileId: string; nonce: string } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [nativeStateById, setNativeStateById] = useState<Record<string, NativeAppRuntimeState>>({})

  useEffect(() => {
    const navigate = props.navigate
    if (!navigate) return

    setDeleting(null)
    setDraggingId(null)
    setDraggingSection(null)
    setDragOverId(null)

    const exists = props.profiles.some((p) => p.id === navigate.profileId)
    if (!exists) {
      setQuery('')
      setRevealTarget(null)
      setScreen({ type: 'list' })
      return
    }

    if (navigate.mode === 'edit') {
      setQuery('')
      setRevealTarget(null)
      setScreen({ type: 'edit', profileId: navigate.profileId })
      return
    }

    setQuery('')
    setScreen({ type: 'list' })
    setRevealTarget({ profileId: navigate.profileId, nonce: navigate.nonce })
  }, [props.navigate, props.profiles])

  useEffect(() => {
    if (!revealTarget) return
    if (screen.type !== 'list') return

    const raf = requestAnimationFrame(() => {
      const el = listRef.current?.querySelector(
        `[data-profile-id="${revealTarget.profileId}"]`
      ) as HTMLElement | null
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })

    const timer = window.setTimeout(() => {
      setRevealTarget(null)
    }, 2000)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [revealTarget, screen.type])

  const existingGroups = useMemo(() => {
    const set = new Set<string>()
    for (const p of props.profiles) {
      const g = p.group?.trim() ?? ''
      if (g) set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [props.profiles])

  useEffect(() => {
    const hasNative = props.profiles.some(isNativeAppProfile)
    if (!hasNative) {
      setNativeStateById({})
      return
    }

    let cancelled = false
    const refresh = async () => {
      try {
        const rows = await listNativeApps()
        if (cancelled) return
        const next: Record<string, NativeAppRuntimeState> = {}
        for (const row of rows) next[row.profile.id] = row.state
        setNativeStateById(next)
      } catch {
        if (!cancelled) setNativeStateById({})
      }
    }

    void refresh()
    const timer = window.setInterval(refresh, 2000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [props.profiles])

  const editingProfile = useMemo(() => {
    if (screen.type !== 'edit') return null
    return props.profiles.find((p) => p.id === screen.profileId) ?? null
  }, [props.profiles, screen])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = [...props.profiles].sort((a, b) => {
      const aPinned = a.pinned ?? true
      const bPinned = b.pinned ?? true
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      const aGroup = normalizeProfileGroup(a.group)
      const bGroup = normalizeProfileGroup(b.group)
      if (aGroup !== bGroup) return aGroup.localeCompare(bGroup)
      const orderDiff = (a.order ?? 0) - (b.order ?? 0)
      if (orderDiff !== 0) return orderDiff
      return a.name.localeCompare(b.name)
    })
    if (!q) return base
    return base.filter((p) => {
      const parts = [p.name]
      if (isWebAppProfile(p)) parts.push(p.startUrl)
      if (isNativeAppProfile(p)) {
        if (p.executable.path) parts.push(p.executable.path)
        if (p.executable.bundleId) parts.push(p.executable.bundleId)
        if (p.executable.appName) parts.push(p.executable.appName)
        if (p.executable.desktopEntry) parts.push(p.executable.desktopEntry)
      }
      return parts.join('\n').toLowerCase().includes(q)
    })
  }, [props.profiles, query])

  const pinnedSorted = useMemo(() => sortPinnedProfiles(props.profiles), [props.profiles])
  const unpinnedSorted = useMemo(() => sortUnpinnedProfiles(props.profiles), [props.profiles])

  const dragEnabled = query.trim().length === 0

  const pinnedInView = useMemo(() => filtered.filter((p) => p.pinned ?? true), [filtered])
  const unpinnedInView = useMemo(() => filtered.filter((p) => !(p.pinned ?? true)), [filtered])

  const groupedPinned = useMemo(() => {
    const map = new Map<string, AppProfile[]>()
    for (const profile of pinnedInView) {
      const key = normalizeProfileGroup(profile.group)
      const list = map.get(key) ?? []
      list.push(profile)
      map.set(key, list)
    }
    return [...map.entries()].map(([key, items]) => ({ key, name: key || '未分组', items }))
  }, [pinnedInView])

  const groupedUnpinned = useMemo(() => {
    const map = new Map<string, AppProfile[]>()
    for (const profile of unpinnedInView) {
      const key = normalizeProfileGroup(profile.group)
      const list = map.get(key) ?? []
      list.push(profile)
      map.set(key, list)
    }
    return [...map.entries()].map(([key, items]) => ({ key, name: key || '未分组', items }))
  }, [unpinnedInView])

  async function onCreate(input: AppProfileInput) {
    if (input.type === 'native') {
      await createProfile(input)
      props.onChanged()
      return
    }

    const webInput = input as WebAppProfileInput
    const id = webInput.id || crypto.randomUUID()
    const patch: WebAppProfileInput = { ...webInput, id, isolation: { partition: `persist:${id}` } }
    await createProfile(patch)
    props.onChanged()
  }

  async function onUpdate(profileId: string, patch: Partial<AppProfileInput>) {
    await updateProfile(profileId, patch)
    props.onChanged()
  }

  async function onDelete(profileId: string) {
    await deleteProfile(profileId)
    setDeleting(null)
    props.onChanged()
  }

  async function onReorderPinned(sourceId: string, targetId: string) {
    const items = computePinnedReorderItems({ pinned: pinnedSorted, sourceId, targetId })
    if (items.length === 0) return
    await batchUpdateProfiles(items)
    props.onChanged()
  }

  async function onReorderUnpinned(sourceId: string, targetId: string) {
    const items = computeGroupReorderItems({ profiles: unpinnedSorted, sourceId, targetId })
    if (items.length === 0) return
    await batchUpdateProfiles(items)
    props.onChanged()
  }

  async function pinAllInGroup(groupKey: string) {
    const normalizedGroup = groupKey
    const toPin = unpinnedSorted.filter((p) => normalizeProfileGroup(p.group) === normalizedGroup)
    if (toPin.length === 0) return

    const maxOrderInGroup = Math.max(
      0,
      ...pinnedSorted
        .filter((p) => normalizeProfileGroup(p.group) === normalizedGroup)
        .map((p) => p.order ?? 0)
    )
    let nextOrder = maxOrderInGroup + 1

    await batchUpdateProfiles(
      toPin.map((profile) => ({
        profileId: profile.id,
        patch: { pinned: true, order: nextOrder++, group: normalizedGroup || undefined }
      }))
    )
    props.onChanged()
  }

  async function unpinAllInGroup(groupKey: string) {
    const normalizedGroup = groupKey
    const toUnpin = pinnedSorted.filter((p) => normalizeProfileGroup(p.group) === normalizedGroup)
    if (toUnpin.length === 0) return

    await batchUpdateProfiles(
      toUnpin.map((profile) => ({
        profileId: profile.id,
        patch: { pinned: false }
      }))
    )
    props.onChanged()
  }

  async function togglePinned(profile: AppProfile) {
    const nextPinned = !(profile.pinned ?? true)
    if (!nextPinned) {
      await updateProfile(profile.id, { pinned: false })
      props.onChanged()
      return
    }
    const group = normalizeProfileGroup(profile.group)
    const maxOrderInGroup = Math.max(
      0,
      ...pinnedSorted
        .filter((p) => normalizeProfileGroup(p.group) === group)
        .map((p) => p.order ?? 0)
    )
    const nextOrder = maxOrderInGroup + 1
    await updateProfile(profile.id, { pinned: true, order: nextOrder })
    props.onChanged()
  }

  async function movePinned(profileId: string, direction: 'up' | 'down') {
    const list = pinnedSorted
    const idx = list.findIndex((p) => p.id === profileId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= list.length) return
    const current = list[idx]
    const target = list[targetIdx]
    if (normalizeProfileGroup(current.group) !== normalizeProfileGroup(target.group)) return
    const currentOrder = current.order ?? idx + 1
    const targetOrder = target.order ?? targetIdx + 1
    await updateProfile(current.id, { order: targetOrder })
    await updateProfile(target.id, { order: currentOrder })
    props.onChanged()
  }

  return (
    <div className="sectionContent">
      {screen.type === 'list' ? (
        <>
          <div className="flex itemsCenter gap2 mb3">
            <div className="searchWrapper flex1">
              <IconSearch className="searchIcon" />
              <input
                className="input searchInput"
                placeholder="搜索应用..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="btn btnPrimary"
              onClick={() => {
                setDeleting(null)
                setDraggingId(null)
                setDraggingSection(null)
                setDragOverId(null)
                setScreen({ type: 'create' })
              }}
            >
              <IconPlus />
              添加
            </button>
          </div>

          <ImportExport onImported={props.onChanged} />

          <div className="flex flexCol gap2" style={{ marginTop: 12 }} ref={listRef}>
            {filtered.length === 0 ? (
              <div className="textMuted" style={{ textAlign: 'center', padding: '24px 0' }}>
                {query ? '未找到匹配的应用' : '暂无应用，点击上方"添加"按钮创建'}
              </div>
            ) : (
              <>
                {groupedPinned.length > 0 && groupedUnpinned.length > 0 && (
                  <div className="listSectionHeader">已固定到侧边栏</div>
                )}
                {groupedPinned.map((group) => (
                  <div key={`pinned:${group.key || 'ungrouped'}`} className="listGroup">
                    <div className="listGroupHeader">
                      <span className="listGroupHeaderTitle">{group.name}</span>
                      <div className="listGroupHeaderActions">
                        <button
                          className="btn btnSm btnGhost"
                          onClick={() => void unpinAllInGroup(group.key)}
                          title="一键取消固定该分组的所有应用"
                        >
                          <IconPinOff />
                          取消固定
                        </button>
                      </div>
                    </div>
                    <div className="flex flexCol gap2">
                      {group.items.map((p) => {
                        const isActive = props.activeProfileId === p.id
                        const isNative = isNativeAppProfile(p)
                        const nativeState = isNative ? nativeStateById[p.id] : undefined
                        const isPinned = p.pinned ?? true
                        const isDragOver = dragOverId === p.id
                        const isDragging = draggingId === p.id
                        const canDrag = dragEnabled && isPinned
                        const isRevealed = revealTarget?.profileId === p.id
                        const secondaryText = isWebAppProfile(p) ? p.startUrl : describeNativeExecutable(p)

                        return (
                          <div
                            key={p.id}
                            data-profile-id={p.id}
                            className={`listItem ${isActive ? 'isActive' : ''} ${isDragOver ? 'isDragOver' : ''} ${isDragging ? 'isDragging' : ''} ${isRevealed ? 'isRevealed' : ''}`}
                            onDragOver={(e) => {
                              if (!canDrag || draggingSection !== 'pinned') return
                              e.preventDefault()
                              if (dragOverId !== p.id) setDragOverId(p.id)
                            }}
                            onDrop={(e) => {
                              if (!canDrag || draggingSection !== 'pinned') return
                              e.preventDefault()
                              const sourceId = draggingId ?? e.dataTransfer.getData('text/plain')
                              if (!sourceId) return
                              void onReorderPinned(sourceId, p.id).finally(() => {
                                setDraggingId(null)
                                setDraggingSection(null)
                                setDragOverId(null)
                              })
                            }}
                          >
                            <div
                              className="listItemIcon"
                              draggable={canDrag}
                              title={canDrag ? '拖拽排序（仅固定到侧边栏的应用）' : undefined}
                              onDragStart={(e) => {
                                if (!canDrag) return
                                setDraggingId(p.id)
                                setDraggingSection('pinned')
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', p.id)
                              }}
                              onDragEnd={() => {
                                setDraggingId(null)
                                setDraggingSection(null)
                                setDragOverId(null)
                              }}
                            >
                              <ProfileIcon profile={p} />
                            </div>
                            <div className="listItemContent">
                              <div className="listItemName" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{p.name}</span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-muted)'
                                  }}
                                >
                                  {isNative ? '原生' : 'Web'}
                                </span>
                                {isNative && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: '2px 6px',
                                      borderRadius: 999,
                                      border: '1px solid var(--border-color)',
                                      color: nativeState?.isRunning ? 'var(--success-color)' : 'var(--text-muted)'
                                    }}
                                    title={nativeState?.launchError ? nativeState.launchError : undefined}
                                  >
                                    {describeNativeStatus(nativeState)}
                                  </span>
                                )}
                              </div>
                              <div className="listItemUrl">{secondaryText}</div>
                            </div>
                            <div className="listItemActions">
                              {isPinned && (
                                <>
                                  <button
                                    className="btn btnSm btnIcon btnGhost"
                                    onClick={() => movePinned(p.id, 'up')}
                                    title="上移"
                                  >
                                    <IconArrowUp />
                                  </button>
                                  <button
                                    className="btn btnSm btnIcon btnGhost"
                                    onClick={() => movePinned(p.id, 'down')}
                                    title="下移"
                                  >
                                    <IconArrowDown />
                                  </button>
                                </>
                              )}
                              <button
                                className="btn btnSm btnIcon btnGhost"
                                onClick={() => togglePinned(p)}
                                title={isPinned ? '从侧边栏隐藏' : '固定到侧边栏'}
                              >
                                {isPinned ? <IconPin /> : <IconPinOff />}
                              </button>
                              <button
                                className="btn btnSm btnIcon btnGhost"
                                onClick={() => {
                                  setDeleting(null)
                                  setDraggingId(null)
                                  setDraggingSection(null)
                                  setDragOverId(null)
                                  setScreen({ type: 'edit', profileId: p.id })
                                }}
                                title="编辑"
                              >
                                <IconPencil />
                              </button>
                              <button
                                className="btn btnSm btnIcon btnGhost"
                                onClick={() => setDeleting(p)}
                                title="删除"
                              >
                                <IconTrash />
                              </button>
                              <button
                                className="btn btnSm btnPrimary"
                                onClick={() => {
                                  if (isWebAppProfile(p)) {
                                    if (isActive) void reloadProfile(p.id)
                                    else void switchProfile(p.id)
                                    return
                                  }
                                  void switchToNativeApp(p.id)
                                }}
                              >
                                {isWebAppProfile(p) && isActive ? <IconRefresh /> : <IconExternalLink />}
                                {isWebAppProfile(p) && isActive ? '刷新' : isNative && nativeState?.isRunning ? '置前' : '打开'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {groupedUnpinned.length > 0 && groupedPinned.length > 0 && (
                  <div className="listSectionHeader" style={{ marginTop: 12 }}>
                    未固定（不会显示在侧边栏）
                  </div>
                )}
                {groupedUnpinned.map((group) => (
                  <div key={`unpinned:${group.key || 'ungrouped'}`} className="listGroup">
                    <div className="listGroupHeader">
                      <span className="listGroupHeaderTitle">{group.name}</span>
                      <div className="listGroupHeaderActions">
                        <button
                          className="btn btnSm btnGhost"
                          onClick={() => void pinAllInGroup(group.key)}
                          title="一键固定该分组的所有应用到侧边栏"
                        >
                          <IconPin />
                          固定分组
                        </button>
                      </div>
                    </div>
                    <div className="flex flexCol gap2">
                      {group.items.map((p) => {
                        const isActive = props.activeProfileId === p.id
                        const isNative = isNativeAppProfile(p)
                        const nativeState = isNative ? nativeStateById[p.id] : undefined
                        const isPinned = p.pinned ?? true
                        const isDragOver = dragOverId === p.id
                        const isDragging = draggingId === p.id
                        const canDrag = dragEnabled && !isPinned
                        const isRevealed = revealTarget?.profileId === p.id
                        const secondaryText = isWebAppProfile(p) ? p.startUrl : describeNativeExecutable(p)
                        return (
                          <div
                            key={p.id}
                            data-profile-id={p.id}
                            className={`listItem ${isActive ? 'isActive' : ''} ${isDragOver ? 'isDragOver' : ''} ${isDragging ? 'isDragging' : ''} ${isRevealed ? 'isRevealed' : ''}`}
                            onDragOver={(e) => {
                              if (!canDrag || draggingSection !== 'unpinned') return
                              e.preventDefault()
                              if (dragOverId !== p.id) setDragOverId(p.id)
                            }}
                            onDrop={(e) => {
                              if (!canDrag || draggingSection !== 'unpinned') return
                              e.preventDefault()
                              const sourceId = draggingId ?? e.dataTransfer.getData('text/plain')
                              if (!sourceId) return
                              void onReorderUnpinned(sourceId, p.id).finally(() => {
                                setDraggingId(null)
                                setDraggingSection(null)
                                setDragOverId(null)
                              })
                            }}
                          >
                            <div
                              className="listItemIcon"
                              draggable={canDrag}
                              title={canDrag ? '拖拽排序' : undefined}
                              onDragStart={(e) => {
                                if (!canDrag) return
                                setDraggingId(p.id)
                                setDraggingSection('unpinned')
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', p.id)
                              }}
                              onDragEnd={() => {
                                setDraggingId(null)
                                setDraggingSection(null)
                                setDragOverId(null)
                              }}
                            >
                              <ProfileIcon profile={p} />
                            </div>
                            <div className="listItemContent">
                              <div className="listItemName" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{p.name}</span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-muted)'
                                  }}
                                >
                                  {isNative ? '原生' : 'Web'}
                                </span>
                                {isNative && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      padding: '2px 6px',
                                      borderRadius: 999,
                                      border: '1px solid var(--border-color)',
                                      color: nativeState?.isRunning ? 'var(--success-color)' : 'var(--text-muted)'
                                    }}
                                    title={nativeState?.launchError ? nativeState.launchError : undefined}
                                  >
                                    {describeNativeStatus(nativeState)}
                                  </span>
                                )}
                              </div>
                              <div className="listItemUrl">{secondaryText}</div>
                            </div>
                            <div className="listItemActions">
                              <button
                                className="btn btnSm btnIcon btnGhost"
                                onClick={() => togglePinned(p)}
                                title={isPinned ? '从侧边栏隐藏' : '固定到侧边栏'}
                              >
                                {isPinned ? <IconPin /> : <IconPinOff />}
                              </button>
                              <button
                                className="btn btnSm btnIcon btnGhost"
                                onClick={() => {
                                  setDeleting(null)
                                  setDraggingId(null)
                                  setDraggingSection(null)
                                  setDragOverId(null)
                                  setScreen({ type: 'edit', profileId: p.id })
                                }}
                                title="编辑"
                              >
                                <IconPencil />
                              </button>
                              <button
                                className="btn btnSm btnIcon btnGhost"
                                onClick={() => setDeleting(p)}
                                title="删除"
                              >
                                <IconTrash />
                              </button>
                              <button
                                className="btn btnSm btnPrimary"
                                onClick={() => {
                                  if (isWebAppProfile(p)) {
                                    if (isActive) void reloadProfile(p.id)
                                    else void switchProfile(p.id)
                                    return
                                  }
                                  void switchToNativeApp(p.id)
                                }}
                              >
                                {isWebAppProfile(p) && isActive ? <IconRefresh /> : <IconExternalLink />}
                                {isWebAppProfile(p) && isActive ? '刷新' : isNative && nativeState?.isRunning ? '置前' : '打开'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="libraryFormHeader">
            <button
              className="btn btnSm btnGhost"
              type="button"
              onClick={() => {
                setDraggingId(null)
                setDraggingSection(null)
                setDragOverId(null)
                setScreen({ type: 'list' })
              }}
            >
              <IconChevronLeft />
              返回
            </button>
            <div className="libraryFormTitle">
              {screen.type === 'create'
                ? '添加应用'
                : editingProfile && isNativeAppProfile(editingProfile)
                  ? '编辑原生应用'
                  : '编辑 Web 应用'}
            </div>
          </div>

          {screen.type === 'edit' && !editingProfile ? (
            <div className="textMuted">应用不存在或已被删除</div>
          ) : (
            <ProfileForm
              initial={screen.type === 'create' ? defaultInput() : toProfileInput(editingProfile!)}
              existingGroups={existingGroups}
              onSubmit={async (input) => {
                if (screen.type === 'create') {
                  await onCreate(input)
                } else {
                  await onUpdate(screen.profileId, input)
                }
                setDraggingId(null)
                setDraggingSection(null)
                setDragOverId(null)
                setScreen({ type: 'list' })
              }}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="删除应用"
        message={`确定要删除 "${deleting?.name}" 吗？此操作不可撤销，应用的所有数据将被清除。`}
        confirmText="删除"
        danger
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) void onDelete(deleting.id)
        }}
      />
    </div>
  )
}
