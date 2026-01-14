import { invokeResult } from './request'
import type { RoutingRule } from '../../../shared/schemas/app-config'

export const routing = {
  getRules: () => invokeResult<RoutingRule[]>('routing:getRules'),
  addRule: (rule: Omit<RoutingRule, 'id' | 'createdAt'>) => invokeResult<RoutingRule>('routing:addRule', rule),
  removeRule: (ruleId: string) => invokeResult<boolean>('routing:removeRule', { ruleId }),
  testUrl: (url: string) =>
    invokeResult<{ matched: boolean; profileId?: string; rule?: RoutingRule; autoMatched?: boolean }>(
      'routing:testUrl',
      { url }
    )
}
