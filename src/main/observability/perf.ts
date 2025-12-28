import type { Logger } from './logger'

export class PerfTracker {
  private switchStartedAt = new Map<string, number>()

  markSwitchStart(profileId: string) {
    this.switchStartedAt.set(profileId, Date.now())
  }

  markSwitchInteractive(logger: Logger, profileId: string) {
    const started = this.switchStartedAt.get(profileId)
    if (!started) return
    const ms = Date.now() - started
    this.switchStartedAt.delete(profileId)
    logger.info('perf.switchInteractive', { profileId, ms })
  }
}

