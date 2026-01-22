import { resolve } from 'node:path'

export type SupportedPlatform = 'darwin' | 'win32' | 'linux' | 'unknown'

export type PathValidationResult = { valid: boolean; error?: string }

/**
 * 获取当前运行平台喵～
 *
 * 基于 Node.js 的 `process.platform` 返回常用平台标识；不在列表内的平台统一返回 `unknown`。
 */
export function getCurrentPlatform(): SupportedPlatform {
  switch (process.platform) {
    case 'darwin':
    case 'win32':
    case 'linux':
      return process.platform
    default:
      return 'unknown'
  }
}

/**
 * 是否为 macOS（darwin）喵～
 */
export function isMacOS(): boolean {
  return getCurrentPlatform() === 'darwin'
}

/**
 * 是否为 Windows（win32）喵～
 */
export function isWindows(): boolean {
  return getCurrentPlatform() === 'win32'
}

/**
 * 是否为 Linux（linux）喵～
 */
export function isLinux(): boolean {
  return getCurrentPlatform() === 'linux'
}

/**
 * 规范化路径喵～
 *
 * 使用 `path.resolve` 将输入路径转换为规范化的绝对路径。
 * 注意：本函数不做安全校验；如需防止路径遍历攻击，请配合 `isPathSafe` / `validatePath` 使用。
 */
export function normalizePath(inputPath: string): string {
  return resolve(inputPath)
}

/**
 * 判断路径是否安全喵～
 *
 * 用于防止路径遍历攻击：检测是否包含 `..` 上级目录跳转片段（例如 `../`、`..\\`）。
 * 该检查为“快速拒绝”，不依赖文件系统，也不会产生副作用。
 */
export function isPathSafe(inputPath: string): boolean {
  if (inputPath.includes('\0')) return false

  // 统一分隔符，避免在不同平台下漏检 `..\\` 等形式
  const normalized = inputPath.replace(/\\/g, '/')
  const segments = normalized.split('/')
  return !segments.some((segment) => segment === '..')
}

/**
 * 校验路径字符串是否有效喵～
 *
 * - 路径不能为空
 * - 路径不能包含空字符（`\0`）
 * - 路径不能包含 `..` 上级目录跳转（防止路径遍历攻击）
 *
 * 返回 `{ valid: true }` 表示通过；失败时返回 `{ valid: false, error: '...' }`。
 */
export function validatePath(inputPath: string): PathValidationResult {
  if (inputPath.trim().length === 0) {
    return { valid: false, error: '路径不能为空' }
  }

  if (inputPath.includes('\0')) {
    return { valid: false, error: '路径包含非法字符' }
  }

  if (!isPathSafe(inputPath)) {
    return { valid: false, error: '路径不安全：禁止包含上级目录跳转（..）' }
  }

  // 触发一次规范化，确保路径可被正常解析（path.resolve 不会产生副作用）
  normalizePath(inputPath)

  return { valid: true }
}

