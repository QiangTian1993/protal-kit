import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename } from 'node:path'
import type { NativeAppProfile } from '../../../shared/types'
import { createLogger, type Logger } from '../../observability/logger'
import type { LaunchResult, PlatformLauncher } from '../native-app-launcher'
import { normalizePath, validatePath } from '../utils/platform'

type CommandResult = { exitCode: number; stdout: string; stderr: string }

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toShortText(value: string, maxLen = 2000): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

async function runCommand(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<CommandResult> {
  return await new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''

    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr })
    })
    child.on('error', (err) => {
      resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${String(err)}` })
    })
  })
}

async function spawnDetached(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, detached: true, stdio: 'ignore' })
    child.once('error', (err) => reject(err))
    child.once('spawn', () => {
      const pid = child.pid
      if (!pid) {
        reject(new Error('无法获取进程 ID'))
        return
      }
      child.unref()
      resolve(pid)
    })
  })
}

function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0)
    return true
  } catch (err) {
    const code = (err as { code?: string } | undefined)?.code
    if (code === 'ESRCH') return false
    return true
  }
}

async function terminateProcess(processId: number, logger: Logger): Promise<void> {
  if (!isProcessRunning(processId)) return

  try {
    process.kill(processId, 'SIGTERM')
  } catch (err) {
    logger.error('nativeApps.macos.terminate.error', { processId, error: String(err) })
    throw new Error('终止失败：无法发送终止信号')
  }

  await delay(500)
  if (!isProcessRunning(processId)) return

  try {
    process.kill(processId, 'SIGKILL')
  } catch (err) {
    logger.error('nativeApps.macos.terminate.forceError', { processId, error: String(err) })
    throw new Error('终止失败：无法强制结束进程')
  }
}

function osascriptArgs(lines: string[], argv: string[]): string[] {
  const out: string[] = []
  for (const line of lines) out.push('-e', line)
  out.push(...argv)
  return out
}

async function queryUnixIdByBundleId(bundleId: string, logger: Logger): Promise<number | undefined> {
  const result = await runCommand(
    '/usr/bin/osascript',
    osascriptArgs(
      [
        'on run argv',
        'set bundleId to item 1 of argv',
        'tell application "System Events"',
        'set appProc to first application process whose bundle identifier is bundleId',
        'return unix id of appProc',
        'end tell',
        'end run'
      ],
      [bundleId]
    )
  )

  if (result.exitCode !== 0) {
    logger.debug('nativeApps.macos.queryPidByBundleId.failed', {
      bundleId,
      stderr: toShortText(result.stderr),
      stdout: toShortText(result.stdout)
    })
    return undefined
  }

  const text = result.stdout.trim()
  const pid = Number.parseInt(text, 10)
  return Number.isFinite(pid) ? pid : undefined
}

async function queryUnixIdByAppName(appName: string, logger: Logger): Promise<number | undefined> {
  const result = await runCommand(
    '/usr/bin/osascript',
    osascriptArgs(
      [
        'on run argv',
        'set appName to item 1 of argv',
        'tell application "System Events"',
        'set appProc to first application process whose name is appName',
        'return unix id of appProc',
        'end tell',
        'end run'
      ],
      [appName]
    )
  )

  if (result.exitCode !== 0) {
    logger.debug('nativeApps.macos.queryPidByName.failed', {
      appName,
      stderr: toShortText(result.stderr),
      stdout: toShortText(result.stdout)
    })
    return undefined
  }

  const text = result.stdout.trim()
  const pid = Number.parseInt(text, 10)
  return Number.isFinite(pid) ? pid : undefined
}

async function waitForProcessId(
  query: () => Promise<number | undefined>,
  timeoutMs: number
): Promise<number | undefined> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const pid = await query()
    if (pid) return pid
    await delay(200)
  }
  return undefined
}

/**
 * macOS 平台启动器喵～
 *
 * - 启动：优先使用 `open -b <bundleId>` 或 `open -a <path>`
 * - 置前：通过 AppleScript（System Events）将指定 PID 对应进程置为 frontmost
 */
export class MacOSLauncher implements PlatformLauncher {
  private logger: Logger

  constructor(args?: { logger?: Logger }) {
    this.logger = args?.logger ?? createLogger()
  }

  /**
   * 启动原生应用喵～
   *
   * 支持：
   * - `bundleId`：`open -b <bundleId>`
   * - `path`：`open -a <path>`
   */
  async launch(profile: NativeAppProfile): Promise<LaunchResult> {
    const bundleId = profile.executable.bundleId
    const appPath = profile.executable.path
    const launchArgs = profile.launchArgs ?? []

    const workingDirectory = profile.workingDirectory
    if (workingDirectory) {
      const validated = validatePath(workingDirectory)
      if (!validated.valid) {
        return { success: false, error: validated.error ?? '工作目录无效，请检查配置' }
      }
    }

    try {
      const cwd = workingDirectory ? normalizePath(workingDirectory) : undefined
      if (cwd) {
        await access(cwd, fsConstants.F_OK)
      }

      const args: string[] = []
      let processIdQuery: (() => Promise<number | undefined>) | null = null

      if (bundleId) {
        args.push('-b', bundleId)
        processIdQuery = () => queryUnixIdByBundleId(bundleId, this.logger)
      } else if (appPath) {
        const validated = validatePath(appPath)
        if (!validated.valid) {
          return { success: false, error: validated.error ?? '应用路径无效，请检查配置' }
        }

        const normalizedPath = normalizePath(appPath)
        await access(normalizedPath, fsConstants.F_OK)
        args.push('-a', normalizedPath)

        const appName = basename(normalizedPath).replace(/\\.app$/i, '')
        if (appName) processIdQuery = () => queryUnixIdByAppName(appName, this.logger)
      } else {
        return { success: false, error: 'macOS 启动需要配置 bundleId 或 path' }
      }

      if (launchArgs.length > 0) {
        args.push('--args', ...launchArgs)
      }

      this.logger.info('nativeApps.macos.launch.start', {
        profileId: profile.id,
        name: profile.name,
        bundleId: bundleId ?? undefined,
        path: appPath ?? undefined,
        cwd: cwd ?? undefined,
        args
      })

      const openPid = await spawnDetached('/usr/bin/open', args, cwd ? { cwd } : undefined)

      const appPid = processIdQuery ? await waitForProcessId(processIdQuery, 3000) : undefined
      const processId = appPid ?? openPid

      this.logger.info('nativeApps.macos.launch.success', {
        profileId: profile.id,
        openPid,
        appPid: appPid ?? null,
        processId
      })

      return { success: true, processId }
    } catch (err) {
      this.logger.error('nativeApps.macos.launch.failed', {
        profileId: profile.id,
        error: String(err),
        bundleId: bundleId ?? undefined,
        path: appPath ?? undefined
      })

      const code = (err as { code?: string } | undefined)?.code
      if (code === 'ENOENT') return { success: false, error: '启动失败：系统缺少 open/osascript 命令' }
      if (code === 'EACCES') return { success: false, error: '启动失败：权限不足，请检查应用路径与权限' }
      return { success: false, error: '启动失败：请检查应用配置与系统环境' }
    }
  }

  /**
   * 进程是否仍在运行喵～
   */
  isRunning(processId: number): boolean {
    return isProcessRunning(processId)
  }

  /**
   * 终止进程喵～
   */
  async terminate(processId: number): Promise<void> {
    this.logger.info('nativeApps.macos.terminate.start', { processId })
    await terminateProcess(processId, this.logger)
    this.logger.info('nativeApps.macos.terminate.done', { processId })
  }

  /**
   * 将应用窗口置前喵～
   *
   * 通过 AppleScript 将指定 `processId` 对应的进程设为 `frontmost`。
   */
  async bringToFront(processId: number): Promise<void> {
    this.logger.info('nativeApps.macos.bringToFront.start', { processId })

    const result = await runCommand(
      '/usr/bin/osascript',
      osascriptArgs(
        [
          'on run argv',
          'set pid to (item 1 of argv) as integer',
          'tell application "System Events"',
          'set frontmost of first application process whose unix id is pid to true',
          'end tell',
          'end run'
        ],
        [String(processId)]
      )
    )

    if (result.exitCode !== 0) {
      const detail = toShortText(result.stderr || result.stdout)
      this.logger.warn('nativeApps.macos.bringToFront.failed', { processId, detail })
      throw new Error(detail ? `置前失败：${detail}` : '置前失败：请检查辅助功能/自动化权限')
    }

    this.logger.info('nativeApps.macos.bringToFront.done', { processId })
  }
}

