import { useEffect, useState } from 'react'
import { useThemeMode } from '../../hooks/useThemeMode'
import { getAppConfig, setLanguage } from '../../lib/ipc/app-config'

export function AppearanceSettings() {
  const theme = useThemeMode()
  const [language, setLang] = useState<'system' | 'zh-CN' | 'en-US'>('system')

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
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>外观</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        <div className="flex itemsCenter justifyBetween">
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
  )
}

