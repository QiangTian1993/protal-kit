import type { NativeAppProfile } from '../../shared/types'
import { createLogger, type Logger } from '../observability/logger'
import { getCurrentPlatform } from './utils/platform'
import { LinuxLauncher } from './launchers/linux-launcher'
import { MacOSLauncher } from './launchers/macos-launcher'
import { MockLauncher } from './launchers/mock-launcher'
import { WindowsLauncher } from './launchers/windows-launcher'

/**
 * 启动结果喵～
 *
 * `processId` 为平台启动器返回的进程 ID（在部分“间接启动”方式下可能无法获取真实应用 PID）。
 */
export interface LaunchResult {
  success: boolean
  processId?: number
  error?: string
}

/**
 * 平台启动器接口喵～
 */
export interface PlatformLauncher {
  launch(profile: NativeAppProfile): Promise<LaunchResult>
  isRunning(processId: number): boolean
  terminate(processId: number): Promise<void>
  bringToFront(processId: number): Promise<void>
}

class UnsupportedPlatformLauncher implements PlatformLauncher {
  constructor(private logger: Logger) {}

  async launch(): Promise<LaunchResult> {
    this.logger.warn('nativeApps.launch.unsupportedPlatform', { platform: process.platform })
    return { success: false, error: '当前平台暂不支持启动原生应用' }
  }

  isRunning(): boolean {
    return false
  }

  async terminate(): Promise<void> {
    throw new Error('当前平台暂不支持终止原生应用')
  }

  async bringToFront(): Promise<void> {
    throw new Error('当前平台暂不支持置前原生应用')
  }
}

/**
 * NativeAppLauncher：跨平台启动器门面（Facade）喵～
 *
 * - 根据 `process.platform` 选择对应的平台启动器
 * - 统一提供 `launch / isRunning / terminate / bringToFront` 接口
 */
export class NativeAppLauncher {
  private launcher: PlatformLauncher

  constructor(args?: { logger?: Logger }) {
    const logger = args?.logger ?? createLogger()
    const platform = getCurrentPlatform()
    this.launcher = this.createPlatformLauncher(platform, logger)
    logger.info('nativeApps.launcher.selected', { platform })
  }

  /**
   * 启动原生应用喵～
   */
  launch(profile: NativeAppProfile): Promise<LaunchResult> {
    return this.launcher.launch(profile)
  }

  /**
   * 进程是否仍在运行喵～
   */
  isRunning(processId: number): boolean {
    return this.launcher.isRunning(processId)
  }

  /**
   * 终止进程喵～
   */
  terminate(processId: number): Promise<void> {
    return this.launcher.terminate(processId)
  }

  /**
   * 将应用窗口置前喵～
   */
  bringToFront(processId: number): Promise<void> {
    return this.launcher.bringToFront(processId)
  }

  private createPlatformLauncher(platform: ReturnType<typeof getCurrentPlatform>, logger: Logger): PlatformLauncher {
    if (process.env.PORTAL_KIT_NATIVE_LAUNCHER === 'mock') return new MockLauncher({ logger })

    switch (platform) {
      case 'darwin':
        return new MacOSLauncher({ logger })
      case 'win32':
        return new WindowsLauncher({ logger })
      case 'linux':
        return new LinuxLauncher({ logger })
      default:
        return new UnsupportedPlatformLauncher(logger)
    }
  }
}
