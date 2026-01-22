import { useEffect, useMemo, useState } from 'react'
import type { AppProfile, Workspace } from '../../shared/types'
import { listProfiles } from '../lib/ipc/profiles'
import { getWorkspace } from '../lib/ipc/workspace'

export type WebAppLoadState =
  | { state: 'idle' }
  | { state: 'loading'; profileId: string }
  | { state: 'loaded'; profileId: string }
  | { state: 'failed'; profileId: string; message: string; url?: string }

export function useAppRuntime() {
  const [profiles, setProfiles] = useState<AppProfile[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<WebAppLoadState>({ state: 'idle' })
  const [navigationState, setNavigationState] = useState<
    Record<string, { canGoBack: boolean; canGoForward: boolean }>
  >({})

  async function refreshProfiles() {
    const next = await listProfiles()
    setProfiles(next)
  }

  async function refreshWorkspace() {
    const res = await getWorkspace()
    setWorkspace(res)
    setActiveProfileId(res.activeProfileId ?? null)
  }

  useEffect(() => {
    void refreshProfiles()
    void refreshWorkspace()
  }, [])

  useEffect(() => {
    const unsubActive = window.portalKit.on('workspace.activeChanged', (p: { profileId: string | null }) => {
      setActiveProfileId(p.profileId)
    })
    const unsubProfilesChanged = window.portalKit.on('profiles.changed', () => {
      void refreshProfiles()
    })
    const unsubLoading = window.portalKit.on('webapp.loading', (p: { profileId: string }) => {
      setLoadState({ state: 'loading', profileId: p.profileId })
    })
    const unsubLoaded = window.portalKit.on('webapp.loaded', (p: { profileId: string }) => {
      setLoadState({ state: 'loaded', profileId: p.profileId })
    })
    const unsubFailed = window.portalKit.on(
      'webapp.loadFailed',
      (p: { profileId: string; message: string; url?: string }) => {
        setLoadState({ state: 'failed', profileId: p.profileId, message: p.message, url: p.url })
      }
    )
    const unsubNav = window.portalKit.on(
      'webapp.navigationState',
      (p: { profileId: string; canGoBack: boolean; canGoForward: boolean }) => {
        setNavigationState((prev) => ({
          ...prev,
          [p.profileId]: { canGoBack: p.canGoBack, canGoForward: p.canGoForward }
        }))
      }
    )
    return () => {
      unsubActive()
      unsubProfilesChanged()
      unsubLoading()
      unsubLoaded()
      unsubFailed()
      unsubNav()
    }
  }, [])

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  )

  return {
    profiles,
    workspace,
    activeProfileId,
    activeProfile,
    loadState,
    navigationState,
    refreshProfiles,
    refreshWorkspace
  }
}
