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

  const wco = (navigator as any).windowControlsOverlay
  if (!isMac && wco && typeof wco.getBoundingClientRect === 'function') {
    const applyInsets = () => {
      const rect = wco.getBoundingClientRect()
      const leftInset = Math.max(0, Math.round(rect.x ?? 0))
      const rightInset = Math.max(0, Math.round(window.innerWidth - ((rect.x ?? 0) + (rect.width ?? 0))))
      const height = Math.max(0, Math.round(rect.height ?? 0))
      document.documentElement.style.setProperty('--window-controls-left-inset', `${leftInset}px`)
      document.documentElement.style.setProperty('--window-controls-right-inset', `${rightInset}px`)
      document.documentElement.style.setProperty('--window-controls-height', `${height}px`)
    }

    applyInsets()
    if (typeof wco.addEventListener === 'function') {
      wco.addEventListener('geometrychange', applyInsets)
    }
    window.addEventListener('resize', applyInsets)
  }
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
