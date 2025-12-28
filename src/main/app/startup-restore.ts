import type { WebAppManager } from '../webapps/webapp-manager'
import type { Logger } from '../observability/logger'

export async function restoreWorkspaceAtStartup(webapps: WebAppManager, logger: Logger) {
  try {
    await webapps.restoreFromWorkspace()
    logger.info('startup.restore.ok')
  } catch (err: any) {
    logger.warn('startup.restore.failed', { message: err?.message ?? String(err) })
  }
}

