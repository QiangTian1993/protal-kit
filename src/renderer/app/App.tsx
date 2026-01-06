import React, { useEffect, useState, useMemo } from 'react'
import { Switcher } from '../features/switcher/Switcher'
import { useAppRuntime } from './useAppRuntime'
import { setLayoutSize } from '../lib/ipc/layout'
import { closeSettingsWindow, openSettingsWindow } from '../lib/ipc/settings'
import { IconSettings, IconGlobe, IconSidebarExpand, IconSidebarCollapse, IconImmersiveOn, IconImmersiveOff } from '../components/Icons'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { LoadingSkeleton, LoadingTimeout } from '../components/LoadingStates'
import { reloadProfile, restoreProfile } from '../lib/ipc/webapps'
import { CommandPalette, type CommandDescriptor } from '../components/CommandPalette'
import { HibernatedView } from '../components/HibernatedView'

export function App() {
  const runtime = useAppRuntime()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false)
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const TOPBAR_HEIGHT = 38
  const SIDEBAR_WIDTH = 56
  const ALL_GROUP_VALUE = '__portal_kit_all_groups__'
  const LOADING_TIMEOUT_MS = 30000 // 30秒超时

  const topbarHeight = immersive ? 0 : TOPBAR_HEIGHT
  const sidebarWidth = sidebarCollapsed || immersive ? 0 : SIDEBAR_WIDTH

  const activeAppName = useMemo(() => {
    return runtime.activeProfile?.name ?? ''
  }, [runtime.activeProfile])

  const commandPaletteCommands = useMemo<CommandDescriptor[]>(() => {
    return [
      {
        id: 'settings.toggle',
        title: settingsDrawerOpen ? '关闭设置' : '打开设置',
        keywords: ['settings', 'preferences', '设置', '偏好'],
        icon: <IconSettings />,
        run: () => (settingsDrawerOpen ? closeSettingsWindow() : openSettingsWindow())
      },
      {
        id: 'sidebar.toggle',
        title: sidebarCollapsed ? '展开侧边栏' : '收起侧边栏',
        keywords: ['sidebar', '侧边栏'],
        icon: sidebarCollapsed ? <IconSidebarExpand /> : <IconSidebarCollapse />,
        run: () => setSidebarCollapsed((prev) => !prev)
      },
      {
        id: 'immersive.toggle',
        title: immersive ? '退出沉浸模式' : '进入沉浸模式',
        keywords: ['immersive', '沉浸'],
        icon: immersive ? <IconImmersiveOn width={15} height={15} /> : <IconImmersiveOff width={15} height={15} />,
        run: () => setImmersive((prev) => !prev)
      }
    ]
  }, [settingsDrawerOpen, sidebarCollapsed, immersive])

  const groupOptions = useMemo(() => {
    const map = new Map<string, { name: string; pinnedCount: number }>()
    for (const profile of runtime.profiles) {
      const key = (profile.group ?? '').trim()
      const existing = map.get(key) ?? { name: key || '未分组', pinnedCount: 0 }
      if (profile.pinned ?? true) existing.pinnedCount += 1
      map.set(key, existing)
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [runtime.profiles])

  useEffect(() => {
    if (activeGroupKey === null) return
    if (groupOptions.some((g) => g.key === activeGroupKey)) return
    setActiveGroupKey(null)
  }, [activeGroupKey, groupOptions])

  useEffect(() => {
    void setLayoutSize({ sidebarWidth, topbarHeight })
  }, [sidebarWidth, topbarHeight])

  // 键盘快捷键
  useKeyboardShortcuts({
    profiles: runtime.profiles,
    activeProfileId: runtime.activeProfileId
  })

  // 加载超时检测
  useEffect(() => {
    if (runtime.loadState.state === 'loading') {
      const timer = setTimeout(() => {
        setLoadingTimeout(true)
      }, LOADING_TIMEOUT_MS)

      return () => clearTimeout(timer)
    } else {
      setLoadingTimeout(false)
    }
  }, [runtime.loadState.state, LOADING_TIMEOUT_MS])

  // Cmd+K 打开搜索面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const unsubToggle = window.portalKit.on('ui.sidebar.toggle', () => {
      setSidebarCollapsed((prev) => !prev)
    })
    const unsubSettings = window.portalKit.on('ui.settings.drawer', (payload: { opened: boolean }) => {
      setSettingsDrawerOpen(payload.opened)
    })
    const unsubImmersive = window.portalKit.on('ui.immersive.toggle', (payload: { enabled: boolean }) => {
      setImmersive(Boolean(payload.enabled))
    })
    return () => {
      unsubToggle()
      unsubSettings()
      unsubImmersive()
    }
  }, [])

  const layoutStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
    '--topbar-height': `${topbarHeight}px`
  } as React.CSSProperties

  return (
    <>
    <div className={`layout ${sidebarCollapsed ? 'isSidebarHidden' : ''}`} style={layoutStyle}>
      {/* Top Bar */}
      {!immersive && (
      <div className="topbar">
        <div className="topbarLeading">
          <select
            className="topbarGroupSelect"
            value={activeGroupKey === null ? ALL_GROUP_VALUE : activeGroupKey}
            onChange={(e) => {
              const next = e.target.value
              setActiveGroupKey(next === ALL_GROUP_VALUE ? null : next)
            }}
            aria-label="选择分组"
            disabled={groupOptions.length === 0}
          >
            <option value={ALL_GROUP_VALUE}>全部分组</option>
            {groupOptions.map((group) => (
              <option key={group.key || 'ungrouped'} value={group.key}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
        <div className="topbarCenter">
          <span className="topbarTitle" aria-current={activeAppName ? 'page' : undefined}>
            {activeAppName || 'Portal Kit'}
          </span>
        </div>
        <div className="topbarTrailing">
          <button
            className="topbarAction"
            type="button"
            onClick={() => setImmersive((prev) => !prev)}
            aria-label={immersive ? '退出沉浸模式' : '进入沉浸模式'}
            title={immersive ? '退出沉浸模式 (⌘⇧M)' : '进入沉浸模式 (⌘⇧M)'}
          >
            {immersive ? <IconImmersiveOn width={15} height={15} /> : <IconImmersiveOff width={15} height={15} />}
          </button>
          <button
            className="topbarAction"
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            {sidebarCollapsed ? <IconSidebarExpand /> : <IconSidebarCollapse />}
          </button>
        </div>
      </div>
      )}

      <div className="layoutBody">
        {/* 侧边栏 */}
        {!immersive && (
        <div className={`sidebar ${sidebarCollapsed ? 'isCollapsed' : ''}`}>
          {!sidebarCollapsed && (
            <>
              <Switcher
                profiles={runtime.profiles}
                activeProfileId={runtime.activeProfileId}
                loadingProfileId={
                  runtime.loadState.state === 'loading' ? runtime.loadState.profileId : null
                }
                activeGroupKey={activeGroupKey}
              />
              <div className="sidebarSpacer" />
              <button
                className="sidebarAction"
                type="button"
                onClick={() =>
                  void (settingsDrawerOpen ? closeSettingsWindow() : openSettingsWindow())
                }
                aria-label={settingsDrawerOpen ? '关闭设置' : '打开设置'}
                title="设置"
              >
                <IconSettings />
              </button>
            </>
          )}
        </div>
        )}

        {/* 主内容区 */}
        <div className="content">
          {!runtime.activeProfile ? (
            <div className="hint">
              <IconGlobe className="hintIcon" />
              <div>选择或添加一个 Web 应用开始使用</div>
              <div className="textMuted" style={{ marginTop: 8, fontSize: 12 }}>
                侧边栏管理应用，右侧显示网页内容
              </div>
            </div>
          ) : runtime.workspace?.perProfileState[runtime.activeProfile.id]?.status === 'hibernated' ? (
            <HibernatedView
              profileName={runtime.activeProfile.name}
              snapshotPath={runtime.workspace.perProfileState[runtime.activeProfile.id]?.snapshotPath}
              onRestore={() => {
                if (runtime.activeProfile) {
                  void restoreProfile(runtime.activeProfile.id)
                }
              }}
            />
          ) : runtime.loadState.state === 'loading' ? (
            loadingTimeout ? (
              <LoadingTimeout
                onRetry={() => {
                  if (runtime.activeProfile) {
                    void reloadProfile(runtime.activeProfile.id)
                  }
                }}
                onCancel={() => {
                  if (runtime.activeProfile) {
                    void reloadProfile(runtime.activeProfile.id)
                  }
                }}
              />
            ) : (
              <LoadingSkeleton message={`正在加载 ${runtime.activeProfile.name}...`} />
            )
          ) : runtime.loadState.state === 'failed' &&
            runtime.loadState.profileId === runtime.activeProfile.id ? (
            <div className="hint">
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>加载失败</div>
              <div className="mono">{runtime.loadState.message}</div>
              <div className="textMuted" style={{ marginTop: 12 }}>
                请检查网络连接或允许域名设置
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>

    {/* 全局搜索面板 */}
    <CommandPalette
      isOpen={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      profiles={runtime.profiles}
      activeProfileId={runtime.activeProfileId}
      recentProfileIds={[]}
      commands={commandPaletteCommands}
    />
    </>
  )
}
