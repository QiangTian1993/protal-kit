import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process'
import { access } from 'node:fs/promises'
import { accessSync, constants as fsConstants } from 'node:fs'
import { delimiter, join } from 'node:path'
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

    child.on('close', (code) => resolve({ exitCode: code ?? 0, stdout, stderr }))
    child.on('error', (err) => resolve({ exitCode: 1, stdout, stderr: `${stderr}\n${String(err)}` }))
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
    logger.error('nativeApps.linux.terminate.error', { processId, error: String(err) })
    throw new Error('终止失败：无法发送终止信号')
  }

  await delay(500)
  if (!isProcessRunning(processId)) return

  try {
    process.kill(processId, 'SIGKILL')
  } catch (err) {
    logger.error('nativeApps.linux.terminate.forceError', { processId, error: String(err) })
    throw new Error('终止失败：无法强制结束进程')
  }
}

function isCommandAvailable(command: string): boolean {
  const pathValue = process.env.PATH ?? ''
  const paths = pathValue.split(delimiter).filter(Boolean)
  for (const dir of paths) {
    const candidate = join(dir, command)
    try {
      accessSync(candidate, fsConstants.X_OK)
      return true
    } catch {
      // ignore
    }
  }
  return false
}

async function bringToFrontWithXdotool(processId: number): Promise<CommandResult> {
  return await runCommand('xdotool', ['search', '--pid', String(processId), 'windowactivate', '--sync'])
}

async function bringToFrontWithWmctrl(processId: number): Promise<void> {
  const list = await runCommand('wmctrl', ['-lp'])
  if (list.exitCode !== 0) {
    throw new Error(toShortText(list.stderr || list.stdout) || 'wmctrl 执行失败')
  }

  const lines = list.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  let windowId: string | undefined
  for (const line of lines) {
    const parts = line.split(/\s+/)
    const pidText = parts[2]
    if (!pidText) continue
    const pid = Number.parseInt(pidText, 10)
    if (pid === processId) {
      windowId = parts[0]
      break
    }
  }

  if (!windowId) {
    throw new Error('未找到该进程对应的窗口')
  }

  const activate = await runCommand('wmctrl', ['-ia', windowId])
  if (activate.exitCode !== 0) {
    throw new Error(toShortText(activate.stderr || activate.stdout) || 'wmctrl 置前失败')
  }
}

/**
 * Linux 平台启动器喵～
 *
 * - 启动：优先通过直接路径启动（可获取 PID）；也支持通过 desktopEntry（gtk-launch / xdg-open）
 * - 置前：优先使用 xdotool，其次 wmctrl（按 PID 查找窗口）
 */
export class LinuxLauncher implements PlatformLauncher {
  private logger: Logger

  constructor(args?: { logger?: Logger }) {
    this.logger = args?.logger ?? createLogger()
  }

  /**
   * 启动原生应用喵～
   *
   * 支持：
   * - `path`：直接启动可执行文件（支持 launchArgs 与 workingDirectory）
   * - `desktopEntry`：使用 gtk-launch 或 xdg-open 启动（可能无法获取真实应用 PID）
   */
  async launch(profile: NativeAppProfile): Promise<LaunchResult> {
    const execPath = profile.executable.path
    const desktopEntry = profile.executable.desktopEntry
    const launchArgs = profile.launchArgs ?? []

    const workingDirectory = profile.workingDirectory
    if (workingDirectory) {
      const cwdValidated = validatePath(workingDirectory)
      if (!cwdValidated.valid) return { success: false, error: cwdValidated.error ?? '工作目录无效，请检查配置' }
    }

    try {
      const cwd = workingDirectory ? normalizePath(workingDirectory) : undefined
      if (cwd) await access(cwd, fsConstants.F_OK)

      if (execPath) {
        const validated = validatePath(execPath)
        if (!validated.valid) return { success: false, error: validated.error ?? '应用路径无效，请检查配置' }

        const command = normalizePath(execPath)
        await access(command, fsConstants.F_OK)

        this.logger.info('nativeApps.linux.launch.start', {
          profileId: profile.id,
          name: profile.name,
          mode: 'path',
          command,
          args: launchArgs,
          cwd: cwd ?? undefined
        })

        const processId = await spawnDetached(command, launchArgs, cwd ? { cwd } : undefined)
        this.logger.info('nativeApps.linux.launch.success', { profileId: profile.id, processId, mode: 'path' })
        return { success: true, processId }
      }

      if (desktopEntry) {
        const validated = validatePath(desktopEntry)
        if (!validated.valid) return { success: false, error: validated.error ?? 'desktopEntry 无效，请检查配置' }

        const hasGtkLaunch = isCommandAvailable('gtk-launch')
        const hasXdgOpen = isCommandAvailable('xdg-open')

        const command = hasGtkLaunch ? 'gtk-launch' : hasXdgOpen ? 'xdg-open' : null
        if (!command) {
          return { success: false, error: '启动失败：系统缺少 gtk-launch 或 xdg-open 命令' }
        }

        const args = command === 'gtk-launch' ? [desktopEntry, ...launchArgs] : [desktopEntry]
        if (command === 'xdg-open' && launchArgs.length > 0) {
          this.logger.warn('nativeApps.linux.launch.argsIgnored', {
            profileId: profile.id,
            reason: 'xdg-open 不支持传递启动参数，将忽略 launchArgs',
            launchArgs
          })
        }

        this.logger.info('nativeApps.linux.launch.start', {
          profileId: profile.id,
          name: profile.name,
          mode: 'desktopEntry',
          command,
          args,
          cwd: cwd ?? undefined
        })

        const processId = await spawnDetached(command, args, cwd ? { cwd } : undefined)
        this.logger.info('nativeApps.linux.launch.success', { profileId: profile.id, processId, mode: 'desktopEntry' })
        return { success: true, processId }
      }

      return { success: false, error: 'Linux 启动需要配置 executable.path 或 executable.desktopEntry' }
    } catch (err) {
      this.logger.error('nativeApps.linux.launch.failed', {
        profileId: profile.id,
        error: String(err),
        path: execPath ?? undefined,
        desktopEntry: desktopEntry ?? undefined
      })
      const code = (err as { code?: string } | undefined)?.code
      if (code === 'ENOENT') return { success: false, error: '启动失败：找不到可执行文件或系统命令' }
      if (code === 'EACCES') return { success: false, error: '启动失败：权限不足，请检查文件权限' }
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
    this.logger.info('nativeApps.linux.terminate.start', { processId })
    await terminateProcess(processId, this.logger)
    this.logger.info('nativeApps.linux.terminate.done', { processId })
  }

  /**
   * 将应用窗口置前喵～
   *
   * - 优先使用 `xdotool`（`search --pid`）
   * - 否则使用 `wmctrl`（解析 `wmctrl -lp` 输出后 `wmctrl -ia`）
   */
  async bringToFront(processId: number): Promise<void> {
    this.logger.info('nativeApps.linux.bringToFront.start', { processId })

    if (isCommandAvailable('xdotool')) {
      const result = await bringToFrontWithXdotool(processId)
      if (result.exitCode !== 0) {
        const detail = toShortText(result.stderr || result.stdout)
        this.logger.warn('nativeApps.linux.bringToFront.xdotoolFailed', { processId, detail })
        throw new Error(detail ? `置前失败：${detail}` : '置前失败：xdotool 执行失败')
      }
      this.logger.info('nativeApps.linux.bringToFront.done', { processId, tool: 'xdotool' })
      return
    }

    if (isCommandAvailable('wmctrl')) {
      try {
        await bringToFrontWithWmctrl(processId)
        this.logger.info('nativeApps.linux.bringToFront.done', { processId, tool: 'wmctrl' })
        return
      } catch (err) {
        const detail = String(err)
        this.logger.warn('nativeApps.linux.bringToFront.wmctrlFailed', { processId, detail })
        throw new Error(`置前失败：${detail}`)
      }
    }

    this.logger.warn('nativeApps.linux.bringToFront.noTool', { processId })
    throw new Error('置前失败：未检测到 xdotool 或 wmctrl，请先安装其中一个工具')
  }
}

