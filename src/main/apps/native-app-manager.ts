import { EventEmitter } from 'node:events'
import type { NativeAppProfile } from '../../shared/types'
import { createLogger, type Logger } from '../observability/logger'
import type { ProfileStore } from '../storage/profile-store'
import { NativeAppLauncher } from './native-app-launcher'

export type NativeAppRuntimeState = {
  processId?: number
  isRunning: boolean
  lastActivatedAt?: string
  launchError?: string
}

export type NativeAppManagerEvents =
  | { type: 'app-opened'; profileId: string; state: NativeAppRuntimeState }
  | { type: 'app-closed'; profileId: string; state: NativeAppRuntimeState }
  | { type: 'app-focused'; profileId: string; state: NativeAppRuntimeState }

/**
 * NativeAppManager：原生应用生命周期管理器喵～
 *
 * - 维护运行时状态：`profileId -> NativeAppRuntimeState`
 * - 串行化同一 profile 的并发操作，避免重复启动/竞争条件
 * - 通过 EventEmitter 发出状态变化事件（异步）
 */
export class NativeAppManager extends EventEmitter {
  private launcher: NativeAppLauncher
  private profiles: ProfileStore
  private logger: Logger

  private stateByProfileId = new Map<string, NativeAppRuntimeState>()
  private queueByProfileId = new Map<string, Promise<unknown>>()
  private monitorIntervalMs = 2000
  private monitorTimer: ReturnType<typeof setInterval> | null = null
  private monitorInFlight = false

  constructor(args: { launcher: NativeAppLauncher; profiles: ProfileStore; logger?: Logger }) {
    super()
    this.launcher = args.launcher
    this.profiles = args.profiles
    this.logger = args.logger ?? createLogger()
  }

  getAppState(profileId: string): NativeAppRuntimeState {
    return { ...(this.stateByProfileId.get(profileId) ?? { isRunning: false }) }
  }

  listRunningApps(): string[] {
    return Array.from(this.stateByProfileId.entries())
      .filter(([, state]) => state.isRunning && state.processId !== undefined)
      .map(([profileId]) => profileId)
  }

  async openApp(profileId: string): Promise<void> {
    await this.runExclusive(profileId, async () => {
      await this.openAppInternal(profileId)
    })
  }

  async closeApp(profileId: string): Promise<void> {
    await this.runExclusive(profileId, async () => {
      await this.closeAppInternal(profileId)
    })
  }

  async switchToApp(profileId: string): Promise<void> {
    await this.runExclusive(profileId, async () => {
      await this.switchToAppInternal(profileId)
    })
  }

  private async openAppInternal(profileId: string): Promise<void> {
    const existing = this.stateByProfileId.get(profileId)
    if (existing?.processId && existing.isRunning && this.launcher.isRunning(existing.processId)) {
      this.logger.debug('nativeApps.manager.open.skipAlreadyRunning', {
        profileId,
        processId: existing.processId
      })
      this.ensureMonitor()
      return
    }

    const profile = await this.getNativeProfile(profileId)

    this.logger.info('nativeApps.manager.open.start', { profileId })
    this.updateState(profileId, { isRunning: false, launchError: undefined })

    const result = await this.launcher.launch(profile)
    if (!result.success || !result.processId) {
      const error = result.error ?? '启动失败：未知错误'
      this.logger.error('nativeApps.manager.open.failed', { profileId, error })
      const state = this.updateState(profileId, { isRunning: false, processId: undefined, launchError: error })
      this.maybeStopMonitor()
      throw new Error(state.launchError ?? error)
    }

    const state = this.updateState(profileId, {
      isRunning: true,
      processId: result.processId,
      lastActivatedAt: new Date().toISOString(),
      launchError: undefined
    })

    this.logger.info('nativeApps.manager.open.success', { profileId, processId: result.processId })
    this.ensureMonitor()
    this.emitAsync({ type: 'app-opened', profileId, state })
  }

  private async switchToAppInternal(profileId: string): Promise<void> {
    const state = this.stateByProfileId.get(profileId)
    const processId = state?.processId
    if (processId && state?.isRunning && this.launcher.isRunning(processId)) {
      this.logger.info('nativeApps.manager.focus.start', { profileId, processId })
      await this.launcher.bringToFront(processId)
      const next = this.updateState(profileId, { lastActivatedAt: new Date().toISOString(), launchError: undefined })
      this.logger.info('nativeApps.manager.focus.done', { profileId, processId })
      this.ensureMonitor()
      this.emitAsync({ type: 'app-focused', profileId, state: next })
      return
    }

    await this.openAppInternal(profileId)

    const next = this.stateByProfileId.get(profileId)
    if (next?.processId) {
      this.logger.info('nativeApps.manager.focusAfterOpen.start', { profileId, processId: next.processId })
      await this.launcher.bringToFront(next.processId)
      const focused = this.updateState(profileId, { lastActivatedAt: new Date().toISOString(), launchError: undefined })
      this.logger.info('nativeApps.manager.focusAfterOpen.done', { profileId, processId: next.processId })
      this.ensureMonitor()
      this.emitAsync({ type: 'app-focused', profileId, state: focused })
    }
  }

  private async closeAppInternal(profileId: string): Promise<void> {
    const state = this.stateByProfileId.get(profileId)
    if (!state?.processId) {
      this.stateByProfileId.delete(profileId)
      this.maybeStopMonitor()
      this.logger.debug('nativeApps.manager.close.skipNoState', { profileId })
      return
    }

    const processId = state.processId
    if (!state.isRunning || !this.launcher.isRunning(processId)) {
      this.stateByProfileId.delete(profileId)
      this.maybeStopMonitor()
      this.logger.info('nativeApps.manager.close.skipNotRunning', { profileId, processId })
      this.emitAsync({ type: 'app-closed', profileId, state: { ...state, isRunning: false } })
      return
    }

    this.logger.info('nativeApps.manager.close.start', { profileId, processId })
    await this.launcher.terminate(processId)
    this.logger.info('nativeApps.manager.close.done', { profileId, processId })

    this.stateByProfileId.delete(profileId)
    this.maybeStopMonitor()
    this.emitAsync({ type: 'app-closed', profileId, state: { ...state, isRunning: false } })
  }

  private ensureMonitor() {
    if (this.monitorTimer) return

    this.monitorTimer = setInterval(() => {
      if (this.monitorInFlight) return
      this.monitorInFlight = true
      void this.monitorTick()
        .catch((err) => {
          this.logger.error('nativeApps.manager.monitor.error', { error: String(err) })
        })
        .finally(() => {
          this.monitorInFlight = false
        })
    }, this.monitorIntervalMs)
  }

  private stopMonitor() {
    const timer = this.monitorTimer
    if (!timer) return
    clearInterval(timer)
    this.monitorTimer = null
    this.monitorInFlight = false
  }

  private maybeStopMonitor() {
    for (const state of this.stateByProfileId.values()) {
      if (state.processId !== undefined) return
    }
    this.stopMonitor()
  }

  private async monitorTick(): Promise<void> {
    const profileIds: string[] = []
    for (const [profileId, state] of this.stateByProfileId.entries()) {
      if (state.processId !== undefined) profileIds.push(profileId)
    }

    if (profileIds.length === 0) {
      this.stopMonitor()
      return
    }

    for (const profileId of profileIds) {
      await this.checkProcessExit(profileId).catch((err) => {
        this.logger.error('nativeApps.manager.monitor.profileError', { profileId, error: String(err) })
      })
    }
  }

  private async checkProcessExit(profileId: string): Promise<void> {
    await this.runExclusive(profileId, async () => {
      const state = this.stateByProfileId.get(profileId)
      if (!state?.processId) {
        return
      }

      if (state.isRunning && this.launcher.isRunning(state.processId)) return

      this.logger.warn('nativeApps.manager.processExited', { profileId, processId: state.processId })
      this.stateByProfileId.delete(profileId)
      this.maybeStopMonitor()
      this.emitAsync({ type: 'app-closed', profileId, state: { ...state, isRunning: false } })
    })
  }

  private updateState(profileId: string, patch: Partial<NativeAppRuntimeState>): NativeAppRuntimeState {
    const prev = this.stateByProfileId.get(profileId) ?? { isRunning: false }
    const next: NativeAppRuntimeState = { ...prev, ...patch }
    this.stateByProfileId.set(profileId, next)
    return { ...next }
  }

  private emitAsync(event: NativeAppManagerEvents): void {
    queueMicrotask(() => this.emit(event.type, event))
  }

  private async getNativeProfile(profileId: string): Promise<NativeAppProfile> {
    const profiles = await this.profiles.listNativeAppProfiles()
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) throw new Error(`profile_not_found:${profileId}`)
    return profile
  }

  private runExclusive<T>(profileId: string, op: () => Promise<T>): Promise<T> {
    const prev = this.queueByProfileId.get(profileId) ?? Promise.resolve()
    const start = prev.catch(() => undefined)
    const result = start.then(op)
    this.queueByProfileId.set(profileId, result.then(() => undefined, () => undefined))
    return result
  }
}
