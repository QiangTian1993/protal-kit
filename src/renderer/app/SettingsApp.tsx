import { useEffect, useState } from 'react'
import { LibraryView } from '../features/library/LibraryView'
import { ClearData } from '../features/settings/ClearData'
import { useAppRuntime } from './useAppRuntime'
import { useThemeMode } from '../hooks/useThemeMode'
import { closeSettingsWindow } from '../lib/ipc/settings'
import { IconClose } from '../components/Icons'
import { getAppConfig, setLanguage } from '../lib/ipc/app-config'

export function SettingsApp() {
  const runtime = useAppRuntime()
  const theme = useThemeMode()
  const [language, setLang] = useState<'system' | 'zh-CN' | 'en-US'>('system')

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

  return (
    <div className="settingsRoot">
      <div className="settingsHeader">
        <h1 className="settingsTitle">设置</h1>
        <button className="btn btnSm btnIcon btnGhost" type="button" onClick={() => void closeSettingsWindow()}>
          <IconClose />
        </button>
      </div>

      <div className="settingsSection">
        <div className="sectionTitle">外观</div>
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

      <div className="settingsSection">
        <div className="sectionTitle">应用管理</div>
        <LibraryView
          profiles={runtime.profiles}
          activeProfileId={runtime.activeProfileId}
          onChanged={() => {
            void runtime.refreshProfiles()
            void runtime.refreshWorkspace()
          }}
        />
      </div>

      <div className="settingsSection">
        <div className="sectionTitle">数据</div>
        <ClearData />
      </div>
    </div>
  )
}
