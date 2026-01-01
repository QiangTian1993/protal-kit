import { invoke } from './request'
import type { RoutingRule } from '../../../shared/schemas/app-config'

export const routing = {
  getRules: () => invoke<RoutingRule[]>('routing:getRules', {}),
  addRule: (rule: Omit<RoutingRule, 'id' | 'createdAt'>) => invoke<RoutingRule>('routing:addRule', rule),
  removeRule: (ruleId: string) => invoke<boolean>('routing:removeRule', { ruleId }),
  testUrl: (url: string) => invoke<{ matched: boolean; profileId?: string }>('routing:testUrl', { url })
}
