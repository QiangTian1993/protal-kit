import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import { SettingsApp } from './app/SettingsApp'
import './styles.css'

// 在渲染前标记平台，便于样式为 macOS 预留系统交通灯区域
try {
  const ua = navigator.userAgent || ''
  const plat = (navigator as any).platform || ''
  const isMac = /Mac/i.test(ua) || /^Mac/i.test(plat)
  document.documentElement.setAttribute('data-platform', isMac ? 'mac' : 'other')
} catch {
  // noop
}

const hash = window.location.hash
const isSettingsWindow = hash === '#/settings' || hash === '#settings'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isSettingsWindow ? <SettingsApp /> : <App />}
  </React.StrictMode>
)
