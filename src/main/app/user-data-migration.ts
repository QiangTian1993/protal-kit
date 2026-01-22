import { app } from 'electron'
import { copyFile, mkdir, stat } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Logger } from '../observability/logger'

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch (err: any) {
    if (err && err.code === 'ENOENT') return false
    throw err
  }
}

async function copyFileIfMissing(src: string, dest: string): Promise<'copied' | 'skipped'> {
  await mkdir(dirname(dest), { recursive: true })
  try {
    await copyFile(src, dest, fsConstants.COPYFILE_EXCL)
    return 'copied'
  } catch (err: any) {
    if (err && err.code === 'EEXIST') return 'skipped'
    throw err
  }
}

export async function migrateLegacyUserDataIfNeeded(logger: Logger) {
  // 仅在打包后启用：开发模式有意使用独立的 userData，避免污染本地开发环境喵～
  if (!app.isPackaged) return

  // 测试/E2E 会显式指定隔离目录，不做迁移
  if (process.env.PORTAL_KIT_USER_DATA_DIR) return

  try {
    const currentUserDataDir = app.getPath('userData')
    const legacyCandidates = ['portal-kit', 'PortalKit']
      .map((name) => join(app.getPath('appData'), name))
      .filter((dir) => dir !== currentUserDataDir)

    const currentProfilesPath = join(currentUserDataDir, 'data', 'profiles.json')
    const hasCurrentProfiles = await pathExists(currentProfilesPath)
    if (hasCurrentProfiles) return

    let legacyUserDataDir: string | null = null
    for (const candidate of legacyCandidates) {
      const legacyProfilesPath = join(candidate, 'data', 'profiles.json')
      if (await pathExists(legacyProfilesPath)) {
        legacyUserDataDir = candidate
        break
      }
    }
    if (!legacyUserDataDir) return

    logger.info('userData.migrate.start', { from: legacyUserDataDir, to: currentUserDataDir })

    const files = ['profiles.json', 'workspace.json', 'app-config.json'] as const
    for (const file of files) {
      const src = join(legacyUserDataDir, 'data', file)
      const dest = join(currentUserDataDir, 'data', file)
      if (!(await pathExists(src))) continue
      const result = await copyFileIfMissing(src, dest)
      logger.info('userData.migrate.file', { file, result })
    }

    logger.info('userData.migrate.done', { from: legacyUserDataDir, to: currentUserDataDir })
  } catch (err: any) {
    logger.warn('userData.migrate.failed', { message: err?.message ?? String(err) })
  }
}
