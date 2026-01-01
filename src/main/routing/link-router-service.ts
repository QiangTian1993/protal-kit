import type { AppConfigStore } from '../storage/app-config-store'
import type { ProfileStore } from '../storage/profile-store'
import type { RoutingRule } from '../../shared/schemas/app-config'
import type { Logger } from '../observability/logger'

export interface RouteMatch {
  matched: boolean
  profileId?: string
  rule?: RoutingRule
  autoMatched?: boolean // 是否是自动匹配的
}

export class LinkRouterService {
  private configStore: AppConfigStore
  private profileStore: ProfileStore
  private logger: Logger
  private rules: RoutingRule[] = []

  constructor(args: { configStore: AppConfigStore; profileStore: ProfileStore; logger: Logger }) {
    this.configStore = args.configStore
    this.profileStore = args.profileStore
    this.logger = args.logger
  }

  async init() {
    await this.loadRules()
  }

  async getRouteForUrl(url: string): Promise<RouteMatch> {
    try {
      const parsedUrl = new URL(url)

      // 1. 首先检查显式规则
      for (const rule of this.rules) {
        const matched = this.matchRule(rule, parsedUrl)
        if (matched) {
          this.logger.info('linkRouter.ruleMatched', { url, ruleId: rule.id, profileId: rule.profileId })
          return { matched: true, profileId: rule.profileId, rule }
        }
      }

      // 2. 智能匹配：检查 URL 是否属于某个应用的 allowedOrigins
      const profiles = await this.profileStore.list()
      const matchedProfiles = profiles.filter((profile) => {
        return profile.allowedOrigins.some((origin) => {
          try {
            const originUrl = new URL(origin)
            // 检查域名是否匹配（包括子域名）
            return (
              parsedUrl.hostname === originUrl.hostname ||
              parsedUrl.hostname.endsWith('.' + originUrl.hostname)
            )
          } catch {
            return false
          }
        })
      })

      if (matchedProfiles.length === 1) {
        // 找到唯一匹配的应用，自动添加规则
        const profile = matchedProfiles[0]
        this.logger.info('linkRouter.autoMatched', { url, profileId: profile.id })

        // 自动创建路由规则
        await this.addRule({
          pattern: parsedUrl.hostname,
          patternType: 'domain',
          profileId: profile.id
        })

        return { matched: true, profileId: profile.id, autoMatched: true }
      }

      if (matchedProfiles.length > 1) {
        // 多个匹配，选择第一个（或者可以让用户选择）
        const profile = matchedProfiles[0]
        this.logger.info('linkRouter.multipleMatched', {
          url,
          profileId: profile.id,
          count: matchedProfiles.length
        })

        // 自动创建路由规则
        await this.addRule({
          pattern: parsedUrl.hostname,
          patternType: 'domain',
          profileId: profile.id
        })

        return { matched: true, profileId: profile.id, autoMatched: true }
      }

      // 3. 没有匹配到任何应用
      return { matched: false }
    } catch (err) {
      this.logger.warn('linkRouter.invalidUrl', { url, error: String(err) })
      return { matched: false }
    }
  }

  async addRule(rule: Omit<RoutingRule, 'id' | 'createdAt'>): Promise<RoutingRule> {
    const newRule: RoutingRule = {
      ...rule,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    }

    this.rules.push(newRule)
    await this.saveRules()

    this.logger.info('linkRouter.ruleAdded', { ruleId: newRule.id, pattern: newRule.pattern })
    return newRule
  }

  async removeRule(ruleId: string): Promise<boolean> {
    const index = this.rules.findIndex((r) => r.id === ruleId)
    if (index === -1) return false

    this.rules.splice(index, 1)
    await this.saveRules()

    this.logger.info('linkRouter.ruleRemoved', { ruleId })
    return true
  }

  async getRules(): Promise<RoutingRule[]> {
    return [...this.rules]
  }

  private matchRule(rule: RoutingRule, url: URL): boolean {
    switch (rule.patternType) {
      case 'domain':
        return this.matchDomain(rule.pattern, url.hostname)
      case 'prefix':
        return url.href.startsWith(rule.pattern)
      case 'regex':
        return this.matchRegex(rule.pattern, url.href)
      default:
        return false
    }
  }

  private matchDomain(pattern: string, hostname: string): boolean {
    // 支持精确匹配和子域名匹配
    // 例如: "github.com" 匹配 "github.com" 和 "api.github.com"
    const normalizedPattern = pattern.toLowerCase()
    const normalizedHostname = hostname.toLowerCase()

    if (normalizedHostname === normalizedPattern) return true
    if (normalizedHostname.endsWith('.' + normalizedPattern)) return true

    return false
  }

  private matchRegex(pattern: string, url: string): boolean {
    try {
      const regex = new RegExp(pattern)
      return regex.test(url)
    } catch (err) {
      this.logger.warn('linkRouter.invalidRegex', { pattern, error: String(err) })
      return false
    }
  }

  private async loadRules() {
    const config = await this.configStore.load()
    this.rules = config.routingRules ?? []
    this.logger.info('linkRouter.rulesLoaded', { count: this.rules.length })
  }

  private async saveRules() {
    const config = await this.configStore.load()
    config.routingRules = this.rules
    await this.configStore.save(config)
  }

  private generateId(): string {
    // 简单的 ID 生成器，使用时间戳 + 随机数
    return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
}
