import type { NativeAppProfile } from '../../../shared/types'
import { createLogger, type Logger } from '../../observability/logger'
import type { LaunchResult, PlatformLauncher } from '../native-app-launcher'

function shouldFailLaunch(profile: NativeAppProfile): string | null {
  const path = profile.executable.path ?? ''
  if (path === '/__portal_kit_invalid__') return '应用路径无效，请检查配置'
  return null
}

/**
 * MockLauncher：用于端到端测试的原生启动器喵～
 *
 * - 不启动真实进程，仅模拟 “已运行/置前/关闭” 行为
 * - 通过环境变量 `PORTAL_KIT_NATIVE_LAUNCHER=mock` 启用
 */
export class MockLauncher implements PlatformLauncher {
  private logger: Logger
  private nextPid = 10_000
  private running = new Set<number>()

  constructor(args?: { logger?: Logger }) {
    this.logger = args?.logger ?? createLogger()
  }

  async launch(profile: NativeAppProfile): Promise<LaunchResult> {
    const error = shouldFailLaunch(profile)
    if (error) {
      this.logger.warn('nativeApps.mock.launch.failed', { profileId: profile.id, error })
      return { success: false, error }
    }

    const processId = this.nextPid++
    this.running.add(processId)
    this.logger.info('nativeApps.mock.launch', { profileId: profile.id, processId })
    return { success: true, processId }
  }

  isRunning(processId: number): boolean {
    return this.running.has(processId)
  }

  async terminate(processId: number): Promise<void> {
    this.running.delete(processId)
  }

  async bringToFront(processId: number): Promise<void> {
    if (!this.running.has(processId)) {
      throw new Error('无法置前：进程未运行')
    }
  }
}

