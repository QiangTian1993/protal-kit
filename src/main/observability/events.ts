import type { Logger } from './logger'

export function logSwitch(logger: Logger, fromProfileId: string | null, toProfileId: string) {
  logger.info('workspace.switch', { fromProfileId, toProfileId })
}

