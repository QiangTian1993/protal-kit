import { useEffect } from 'react'
import type { WebAppProfile } from '../../shared/types'
import { switchProfile, closeProfile } from '../lib/ipc/workspace'

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
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey

      // Cmd/Ctrl + 1-9: 切换到第 N 个 Profile
      if (cmdOrCtrl && !e.shiftKey && !e.altKey) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= 9) {
          e.preventDefault()
          const targetProfile = profiles[num - 1]
          if (targetProfile) {
            void switchProfile(targetProfile.id)
          }
          return
        }
      }

      // Cmd/Ctrl + [: 切换到上一个 Profile
      if (cmdOrCtrl && e.key === '[' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        if (onNavigatePrev) {
          onNavigatePrev()
        } else {
          navigateToPrevProfile(profiles, activeProfileId)
        }
        return
      }

      // Cmd/Ctrl + ]: 切换到下一个 Profile
      if (cmdOrCtrl && e.key === ']' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        if (onNavigateNext) {
          onNavigateNext()
        } else {
          navigateToNextProfile(profiles, activeProfileId)
        }
        return
      }

      // Cmd/Ctrl + W: 关闭当前 Profile
      if (cmdOrCtrl && e.key === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        if (activeProfileId) {
          void closeProfile(activeProfileId)
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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
