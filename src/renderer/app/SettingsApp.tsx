import { useEffect, useState } from 'react'
import { LibraryView } from '../features/library/LibraryView'
import { ClearData } from '../features/settings/ClearData'
import { RoutingSettings } from '../features/settings/RoutingSettings'
import { WindowSettings } from '../features/settings/WindowSettings'
import { useAppRuntime } from './useAppRuntime'
import { useThemeMode } from '../hooks/useThemeMode'
import { closeSettingsWindow } from '../lib/ipc/settings'
import { IconClose } from '../components/Icons'
import { getAppConfig, setLanguage } from '../lib/ipc/app-config'

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
  const theme = useThemeMode()
  const [language, setLang] = useState<'system' | 'zh-CN' | 'en-US'>('system')
  const [libraryNavigate, setLibraryNavigate] = useState<
    (LibraryNavigatePayload & { nonce: string }) | null
  >(null)

  const sectionStyle = { marginBottom: 16, paddingBottom: 24 } as const
  const lastSectionStyle = { marginBottom: 0, paddingBottom: 24 } as const
  const sectionTitleStyle = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 16,
    textTransform: 'none',
    letterSpacing: 0,
    color: 'var(--text-primary)'
  } as const

  useEffect(() => {
    document.body.classList.add('isSettingsWindow')
    return () => document.body.classList.remove('isSettingsWindow')
  }, [])

  useEffect(() => {
    void (async () => {
      const cfg = await getAppConfig()
      setLang(cfg.language)
    })()
    const unsub = window.portalKit.on('ui.language.changed', (p: { language: typeof language }) => {
      setLang(p.language)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = window.portalKit.on('ui.library.navigate', (payload: unknown) => {
      if (!isLibraryNavigatePayload(payload)) return
      setLibraryNavigate({ ...payload, nonce: crypto.randomUUID() })
    })
    return () => unsub()
  }, [])

  return (
    <div className="settingsRoot">
      <div className="settingsHeader">
        <h1 className="settingsTitle">设置</h1>
        <button
          className="btn btnSm btnIcon btnGhost"
          type="button"
          onClick={() => void closeSettingsWindow()}
          aria-label="关闭设置"
        >
          <IconClose />
        </button>
      </div>

      <div className="settingsSection" style={sectionStyle}>
        <div className="sectionTitle" style={sectionTitleStyle}>
          外观
        </div>
        <div className="sectionContent">
          <div className="flex itemsCenter justifyBetween">
            <label className="textSecondary" htmlFor="theme-mode">
              主题模式
            </label>
            <select
              id="theme-mode"
              className="select"
              value={theme.mode}
              onChange={(event) => {
                theme.setMode(event.target.value as typeof theme.mode)
              }}
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </div>
          <div className="flex itemsCenter justifyBetween" style={{ marginTop: 12 }}>
            <label className="textSecondary" htmlFor="app-language">
              系统语言
            </label>
            <select
              id="app-language"
              className="select"
              value={language}
              onChange={(e) => void setLanguage(e.target.value as typeof language)}
            >
              <option value="system">跟随系统</option>
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English (US)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="settingsSection" style={sectionStyle}>
        <div className="sectionTitle" style={sectionTitleStyle}>
          窗口
        </div>
        <WindowSettings />
      </div>

      <div className="settingsSection" style={sectionStyle}>
        <div className="sectionTitle" style={sectionTitleStyle}>
          应用管理
        </div>
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

      <div className="settingsSection" style={sectionStyle}>
        <div className="sectionTitle" style={sectionTitleStyle}>
          链接路由
        </div>
        <RoutingSettings profiles={runtime.profiles} />
      </div>

      <div className="settingsSection" style={lastSectionStyle}>
        <div className="sectionTitle" style={sectionTitleStyle}>
          数据
        </div>
        <ClearData />
      </div>
    </div>
  )
}
