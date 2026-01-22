import type { AppProfile } from '../../shared/types'
import { isNativeAppProfile, isWebAppProfile } from '../../shared/types'
import { createLogger, type Logger } from '../observability/logger'
import type { ProfileStore } from '../storage/profile-store'
import type { WebAppManager } from '../webapps/webapp-manager'
import type { NativeAppManager } from './native-app-manager'

/**
 * UnifiedAppManager：统一应用管理协调器喵～
 *
 * 目标：屏蔽 Web/原生差异，为 IPC 与上层 UI 提供单一入口：
 * - openProfile / closeProfile / switchToProfile
 * - getActiveProfile
 */
export class UnifiedAppManager {
  private profiles: ProfileStore
  private webapps: WebAppManager
  private nativeApps: NativeAppManager
  private logger: Logger

  private activeProfile: AppProfile | null = null
  private webViewHiddenForNative = false

  constructor(args: { profiles: ProfileStore; webapps: WebAppManager; nativeApps: NativeAppManager; logger?: Logger }) {
    this.profiles = args.profiles
    this.webapps = args.webapps
    this.nativeApps = args.nativeApps
    this.logger = args.logger ?? createLogger()
  }

  getActiveProfile(): AppProfile | null {
    return this.activeProfile
  }

  async openProfile(profileId: string): Promise<void> {
    await this.switchToProfile(profileId)
  }

  async closeProfile(profileId: string): Promise<void> {
    const resolved = await this.resolveProfileOrNull(profileId)

    if (resolved && isNativeAppProfile(resolved)) {
      await this.nativeApps.closeApp(profileId)
    } else {
      await this.webapps.closeProfile(profileId)
      await this.nativeApps.closeApp(profileId)
    }

    if (this.activeProfile?.id === profileId) {
      this.activeProfile = null
    }
  }

  async switchToProfile(profileId: string): Promise<void> {
    const profile = await this.resolveProfile(profileId)

    if (isNativeAppProfile(profile)) {
      if (this.activeProfile && isWebAppProfile(this.activeProfile) && !this.webViewHiddenForNative) {
        this.logger.info('apps.switch.hideWebViewForNative', { fromProfileId: this.activeProfile.id })
        this.webapps.hideActiveView()
        this.webViewHiddenForNative = true
      }

      this.logger.info('apps.switch.native.start', { profileId })
      await this.nativeApps.switchToApp(profileId)
      this.activeProfile = profile
      this.logger.info('apps.switch.native.done', { profileId })
      return
    }

    this.logger.info('apps.switch.web.start', { profileId })
    await this.webapps.switchToProfile(profileId)
    if (this.webViewHiddenForNative) {
      this.webapps.showActiveView()
      this.webViewHiddenForNative = false
    }
    this.activeProfile = profile
    this.logger.info('apps.switch.web.done', { profileId })
  }

  private resolveTempWebProfile(profileId: string): AppProfile | null {
    const temp = this.webapps.getTempProfiles().find((p) => p.id === profileId)
    return temp ?? null
  }

  private async resolveProfile(profileId: string): Promise<AppProfile> {
    const temp = this.resolveTempWebProfile(profileId)
    if (temp) return temp

    const profiles = await this.profiles.exportProfiles()
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) throw new Error(`profile_not_found:${profileId}`)
    return profile
  }

  private async resolveProfileOrNull(profileId: string): Promise<AppProfile | null> {
    try {
      return await this.resolveProfile(profileId)
    } catch (err) {
      this.logger.warn('apps.resolveProfile.failed', { profileId, error: String(err) })
      return null
    }
  }
}

