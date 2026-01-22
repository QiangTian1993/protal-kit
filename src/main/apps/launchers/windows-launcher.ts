import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
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
    const child = spawn(command, args, { ...options, detached: true, stdio: 'ignore', windowsHide: true })
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
    logger.error('nativeApps.windows.terminate.error', { processId, error: String(err) })
    throw new Error('终止失败：无法结束进程')
  }

  await delay(500)
  if (!isProcessRunning(processId)) return

  try {
    process.kill(processId, 'SIGKILL')
  } catch (err) {
    logger.error('nativeApps.windows.terminate.forceError', { processId, error: String(err) })
    throw new Error('终止失败：无法强制结束进程')
  }
}

function buildBringToFrontScript(): string {
  // PowerShell 脚本：按 PID 找到窗口句柄并置前
  return [
    '$pid = [int]$args[0]',
    '$proc = Get-Process -Id $pid -ErrorAction Stop',
    '$hwnd = $proc.MainWindowHandle',
    'if ($hwnd -eq 0) { Start-Sleep -Milliseconds 200; $proc.Refresh(); $hwnd = $proc.MainWindowHandle }',
    'if ($hwnd -eq 0) { throw "未找到窗口句柄，应用可能尚未创建主窗口" }',
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public static class Win32 {',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);',
    '}',
    '"@',
    '[Win32]::ShowWindowAsync($hwnd, 9) | Out-Null',
    '[Win32]::SetForegroundWindow($hwnd) | Out-Null'
  ].join('; ')
}

/**
 * Windows 平台启动器喵～
 *
 * - 启动：直接执行 exe 路径（不使用 shell），参数通过数组传递
 * - 置前：通过 PowerShell + user32.dll 将窗口置前
 */
export class WindowsLauncher implements PlatformLauncher {
  private logger: Logger

  constructor(args?: { logger?: Logger }) {
    this.logger = args?.logger ?? createLogger()
  }

  /**
   * 启动原生应用喵～
   *
   * 仅支持 `executable.path`（exe 路径）。
   */
  async launch(profile: NativeAppProfile): Promise<LaunchResult> {
    const exePath = profile.executable.path
    if (!exePath) return { success: false, error: 'Windows 启动需要配置可执行文件路径（path）' }

    const validated = validatePath(exePath)
    if (!validated.valid) return { success: false, error: validated.error ?? '应用路径无效，请检查配置' }

    const workingDirectory = profile.workingDirectory
    if (workingDirectory) {
      const cwdValidated = validatePath(workingDirectory)
      if (!cwdValidated.valid) return { success: false, error: cwdValidated.error ?? '工作目录无效，请检查配置' }
    }

    try {
      const command = normalizePath(exePath)
      await access(command, fsConstants.F_OK)

      const cwd = workingDirectory ? normalizePath(workingDirectory) : undefined
      if (cwd) await access(cwd, fsConstants.F_OK)

      const args = profile.launchArgs ?? []

      this.logger.info('nativeApps.windows.launch.start', {
        profileId: profile.id,
        name: profile.name,
        command,
        args,
        cwd: cwd ?? undefined
      })

      const processId = await spawnDetached(command, args, cwd ? { cwd } : undefined)

      this.logger.info('nativeApps.windows.launch.success', { profileId: profile.id, processId })
      return { success: true, processId }
    } catch (err) {
      this.logger.error('nativeApps.windows.launch.failed', { profileId: profile.id, error: String(err), exePath })
      const code = (err as { code?: string } | undefined)?.code
      if (code === 'ENOENT') return { success: false, error: '启动失败：找不到可执行文件，请检查路径' }
      if (code === 'EACCES') return { success: false, error: '启动失败：权限不足，请以管理员权限或检查文件权限' }
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
    this.logger.info('nativeApps.windows.terminate.start', { processId })
    await terminateProcess(processId, this.logger)
    this.logger.info('nativeApps.windows.terminate.done', { processId })
  }

  /**
   * 将应用窗口置前喵～
   *
   * 通过 PowerShell 脚本按 PID 获取主窗口句柄，并调用 user32.dll 将窗口置前。
   */
  async bringToFront(processId: number): Promise<void> {
    this.logger.info('nativeApps.windows.bringToFront.start', { processId })
    const script = buildBringToFrontScript()
    const result = await runCommand('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
      String(processId)
    ])

    if (result.exitCode !== 0) {
      const detail = toShortText(result.stderr || result.stdout)
      this.logger.warn('nativeApps.windows.bringToFront.failed', { processId, detail })
      throw new Error(detail ? `置前失败：${detail}` : '置前失败：请检查 PowerShell 权限与窗口状态')
    }

    this.logger.info('nativeApps.windows.bringToFront.done', { processId })
  }
}
