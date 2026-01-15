import { useEffect, useState } from 'react'
import { LibraryView } from '../features/library/LibraryView'
import { ClearData } from '../features/settings/ClearData'
import { RoutingSettings } from '../features/settings/RoutingSettings'
import { WindowSettings } from '../features/settings/WindowSettings'
import { useAppRuntime } from './useAppRuntime'
import { closeSettingsWindow } from '../lib/ipc/settings'
import { IconClose } from '../components/Icons'
import { AppearanceSettings } from '../features/settings/AppearanceSettings'
import { NavItem } from '../components/NavItem'

type LibraryNavigatePayload = { mode: 'edit' | 'reveal'; profileId: string }

function isLibraryNavigatePayload(value: unknown): value is LibraryNavigatePayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    (v.mode === 'edit' || v.mode === 'reveal') &&
    typeof v.profileId === 'string' &&
    v.profileId.trim().length > 0
  )
}

export function SettingsApp() {
  const runtime = useAppRuntime()
  const [activeTab, setActiveTab] = useState<'appearance' | 'window' | 'apps' | 'routing' | 'data'>(
    'appearance'
  )
  const [libraryNavigate, setLibraryNavigate] = useState<
    (LibraryNavigatePayload & { nonce: string }) | null
  >(null)

  useEffect(() => {
    document.body.classList.add('isSettingsWindow')
    return () => document.body.classList.remove('isSettingsWindow')
  }, [])

  useEffect(() => {
    const unsub = window.portalKit.on('ui.library.navigate', (payload: unknown) => {
      if (!isLibraryNavigatePayload(payload)) return
      setLibraryNavigate({ ...payload, nonce: crypto.randomUUID() })
      setActiveTab('apps')
    })
    return () => unsub()
  }, [])

  return (
    <div
      className="settingsRoot"
      style={{ display: 'flex', flexDirection: 'row', height: '100vh', overflow: 'hidden', padding: 0, gap: 0 }}
    >
      <nav
        style={{
          width: 200,
          padding: '16px 12px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 12
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>设置</h1>
          <button
            className="btn btnSm btnIcon btnGhost"
            type="button"
            onClick={() => void closeSettingsWindow()}
            aria-label="关闭设置"
          >
            <IconClose />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavItem
            icon="🎨"
            label="外观"
            isActive={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
          />
          <NavItem
            icon="🪟"
            label="窗口"
            isActive={activeTab === 'window'}
            onClick={() => setActiveTab('window')}
          />
          <NavItem
            icon="📱"
            label="应用管理"
            isActive={activeTab === 'apps'}
            onClick={() => setActiveTab('apps')}
          />
          <NavItem
            icon="🔗"
            label="链接路由"
            isActive={activeTab === 'routing'}
            onClick={() => setActiveTab('routing')}
          />
          <NavItem
            icon="🗑️"
            label="数据管理"
            isActive={activeTab === 'data'}
            onClick={() => setActiveTab('data')}
          />
        </div>
      </nav>

      <div className="settingsContent" style={{ flex: 1, padding: 24, overflow: 'auto' }}>
        <div style={{ display: activeTab === 'appearance' ? 'block' : 'none' }}>
          <AppearanceSettings />
        </div>
        <div style={{ display: activeTab === 'window' ? 'block' : 'none' }}>
          <WindowSettings />
        </div>
        <div style={{ display: activeTab === 'apps' ? 'block' : 'none' }}>
          <LibraryView
            profiles={runtime.profiles}
            activeProfileId={runtime.activeProfileId}
            navigate={libraryNavigate ?? undefined}
            onChanged={() => {
              void runtime.refreshProfiles()
              void runtime.refreshWorkspace()
            }}
          />
        </div>
        <div style={{ display: activeTab === 'routing' ? 'block' : 'none' }}>
          <RoutingSettings profiles={runtime.profiles} />
        </div>
        <div style={{ display: activeTab === 'data' ? 'block' : 'none' }}>
          <ClearData />
        </div>
      </div>
    </div>
  )
}
