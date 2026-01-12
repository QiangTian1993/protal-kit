import { useEffect } from 'react'
import type { WebAppProfile } from '../../shared/types'
import { switchProfile, closeProfile } from '../lib/ipc/workspace'
import { reloadProfile } from '../lib/ipc/webapps'

interface UseKeyboardShortcutsOptions {
  profiles: WebAppProfile[]
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

        // Cmd/Ctrl + 1-9: 切换到第 N 个 Profile
        if (cmdOrCtrl && !payload.shiftKey && !payload.altKey) {
          const num = parseInt(key, 10)
          if (num >= 1 && num <= 9) {
            const targetProfile = profiles[num - 1]
            if (targetProfile) {
              void switchProfile(targetProfile.id)
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
            void closeProfile(activeProfileId)
          }
          return
        }

        // Cmd/Ctrl + R: 刷新当前 Profile (Shift 强制刷新)
        if (cmdOrCtrl && key.toLowerCase() === 'r') {
          if (activeProfileId) {
            void reloadProfile(activeProfileId, { ignoreCache: payload.shiftKey })
          }
        }
      }
    )

    return () => unsub()
  }, [profiles, activeProfileId, onNavigateNext, onNavigatePrev])
}

function navigateToNextProfile(profiles: WebAppProfile[], activeProfileId: string | null) {
  if (profiles.length === 0) return

  if (!activeProfileId) {
    void switchProfile(profiles[0].id)
    return
  }

  const currentIndex = profiles.findIndex((p) => p.id === activeProfileId)
  if (currentIndex === -1) {
    void switchProfile(profiles[0].id)
    return
  }

  const nextIndex = (currentIndex + 1) % profiles.length
  void switchProfile(profiles[nextIndex].id)
}

function navigateToPrevProfile(profiles: WebAppProfile[], activeProfileId: string | null) {
  if (profiles.length === 0) return

  if (!activeProfileId) {
    void switchProfile(profiles[profiles.length - 1].id)
    return
  }

  const currentIndex = profiles.findIndex((p) => p.id === activeProfileId)
  if (currentIndex === -1) {
    void switchProfile(profiles[profiles.length - 1].id)
    return
  }

  const prevIndex = currentIndex === 0 ? profiles.length - 1 : currentIndex - 1
  void switchProfile(profiles[prevIndex].id)
}
