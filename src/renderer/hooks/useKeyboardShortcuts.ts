import { useEffect } from 'react'
import { isNativeAppProfile, isWebAppProfile, type AppProfile } from '../../shared/types'
import { switchProfile, closeProfile } from '../lib/ipc/workspace'
import { reloadProfile } from '../lib/ipc/webapps'
import { closeNativeApp, switchToNativeApp } from '../lib/ipc/native-apps'

interface UseKeyboardShortcutsOptions {
  profiles: AppProfile[]
  activeProfileId: string | null
  onNavigateNext?: () => void
  onNavigatePrev?: () => void
}

export function useKeyboardShortcuts({
  profiles,
  activeProfileId,
  onNavigateNext,
  onNavigatePrev
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const unsub = window.portalKit.on(
      'ui.keyboard.shortcut',
      (payload: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }) => {
        const key = payload.key
        const isMac = document.documentElement.getAttribute('data-platform') === 'mac'
        const cmdOrCtrl = isMac ? payload.metaKey : payload.ctrlKey

        const activeProfile = activeProfileId ? profiles.find((p) => p.id === activeProfileId) ?? null : null

        // Cmd/Ctrl + 1-9: 切换到第 N 个 Profile
        if (cmdOrCtrl && !payload.shiftKey && !payload.altKey) {
          const num = parseInt(key, 10)
          if (num >= 1 && num <= 9) {
            const targetProfile = profiles[num - 1]
            if (targetProfile) {
              if (isNativeAppProfile(targetProfile)) void switchToNativeApp(targetProfile.id)
              else void switchProfile(targetProfile.id)
            }
            return
          }
        }

        // Cmd/Ctrl + [: 切换到上一个 Profile
        if (cmdOrCtrl && key === '[' && !payload.shiftKey && !payload.altKey) {
          if (onNavigatePrev) {
            onNavigatePrev()
          } else {
            navigateToPrevProfile(profiles, activeProfileId)
          }
          return
        }

        // Cmd/Ctrl + ]: 切换到下一个 Profile
        if (cmdOrCtrl && key === ']' && !payload.shiftKey && !payload.altKey) {
          if (onNavigateNext) {
            onNavigateNext()
          } else {
            navigateToNextProfile(profiles, activeProfileId)
          }
          return
        }

        // Cmd/Ctrl + W: 关闭当前 Profile
        if (cmdOrCtrl && key.toLowerCase() === 'w' && !payload.shiftKey && !payload.altKey) {
          if (activeProfileId) {
            if (activeProfile && isNativeAppProfile(activeProfile)) void closeNativeApp(activeProfileId)
            else void closeProfile(activeProfileId)
          }
          return
        }

        // Cmd/Ctrl + R: 刷新当前 Profile (Shift 强制刷新)
        if (cmdOrCtrl && key.toLowerCase() === 'r') {
          if (activeProfileId && activeProfile && isWebAppProfile(activeProfile)) {
            void reloadProfile(activeProfileId, { ignoreCache: payload.shiftKey })
          }
        }
      }
    )

    return () => unsub()
  }, [profiles, activeProfileId, onNavigateNext, onNavigatePrev])
}

function navigateToNextProfile(profiles: AppProfile[], activeProfileId: string | null) {
  if (profiles.length === 0) return

  if (!activeProfileId) {
    const target = profiles[0]
    if (target) {
      if (isNativeAppProfile(target)) void switchToNativeApp(target.id)
      else void switchProfile(target.id)
    }
    return
  }

  const currentIndex = profiles.findIndex((p) => p.id === activeProfileId)
  if (currentIndex === -1) {
    const target = profiles[0]
    if (target) {
      if (isNativeAppProfile(target)) void switchToNativeApp(target.id)
      else void switchProfile(target.id)
    }
    return
  }

  const nextIndex = (currentIndex + 1) % profiles.length
  const target = profiles[nextIndex]
  if (!target) return
  if (isNativeAppProfile(target)) void switchToNativeApp(target.id)
  else void switchProfile(target.id)
}

function navigateToPrevProfile(profiles: AppProfile[], activeProfileId: string | null) {
  if (profiles.length === 0) return

  if (!activeProfileId) {
    const target = profiles[profiles.length - 1]
    if (target) {
      if (isNativeAppProfile(target)) void switchToNativeApp(target.id)
      else void switchProfile(target.id)
    }
    return
  }

  const currentIndex = profiles.findIndex((p) => p.id === activeProfileId)
  if (currentIndex === -1) {
    const target = profiles[profiles.length - 1]
    if (target) {
      if (isNativeAppProfile(target)) void switchToNativeApp(target.id)
      else void switchProfile(target.id)
    }
    return
  }

  const prevIndex = currentIndex === 0 ? profiles.length - 1 : currentIndex - 1
  const target = profiles[prevIndex]
  if (!target) return
  if (isNativeAppProfile(target)) void switchToNativeApp(target.id)
  else void switchProfile(target.id)
}
