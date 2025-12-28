import { useEffect, useState } from 'react'
import { setThemeSource } from '../lib/ipc/theme'

const STORAGE_KEY = 'portal-kit-theme-mode'

export type ThemeMode = 'system' | 'light' | 'dark'

const themeModes: ThemeMode[] = ['system', 'light', 'dark']

const readStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return themeModes.includes(stored as ThemeMode) ? (stored as ThemeMode) : 'system'
}

export const useThemeMode = () => {
  const [mode, setMode] = useState<ThemeMode>(() => readStoredMode())

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (nextMode: ThemeMode) => {
      const applied = nextMode === 'system' ? (media.matches ? 'dark' : 'light') : nextMode
      root.setAttribute('data-theme', applied)
    }

    applyTheme(mode)
    void setThemeSource(mode)

    if (mode === 'system') {
      window.localStorage.removeItem(STORAGE_KEY)
      const handleChange = () => applyTheme('system')
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', handleChange)
        return () => media.removeEventListener('change', handleChange)
      }
      media.addListener(handleChange)
      return () => media.removeListener(handleChange)
    }

    window.localStorage.setItem(STORAGE_KEY, mode)
    return
  }, [mode])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = readStoredMode()
      setMode(next)
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return { mode, setMode }
}
