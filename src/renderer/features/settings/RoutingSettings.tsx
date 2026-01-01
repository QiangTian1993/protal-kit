import { useState, useEffect } from 'react'
import { routing } from '../../lib/ipc/routing'
import type { RoutingRule } from '../../../shared/schemas/app-config'
import type { WebAppProfile } from '../../../shared/types'
import { IconPlus, IconTrash, IconGlobe } from '../../components/Icons'
import { ConfirmDialog } from '../../components/Modal'

interface RoutingSettingsProps {
  profiles: WebAppProfile[]
}

export function RoutingSettings({ profiles }: RoutingSettingsProps) {
  const [rules, setRules] = useState<RoutingRule[]>([])
  const [loading, setLoading] = useState(true)
  const [newPattern, setNewPattern] = useState('')
  const [newPatternType, setNewPatternType] = useState<'domain' | 'prefix' | 'regex'>('domain')
  const [newProfileId, setNewProfileId] = useState('')
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)

  useEffect(() => {
    void loadRules()
    if (profiles.length > 0) {
      setNewProfileId(profiles[0].id)
    }
  }, [profiles])

  async function loadRules() {
    try {
      setLoading(true)
      const fetchedRules = await routing.getRules()
      setRules(fetchedRules)
    } catch (err) {
      console.error('Failed to load routing rules:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddRule() {
    if (!newPattern.trim() || !newProfileId) {
      return
    }

    try {
      await routing.addRule({
        pattern: newPattern.trim(),
        patternType: newPatternType,
        profileId: newProfileId
      })
      setNewPattern('')
      await loadRules()
    } catch (err) {
      console.error('Failed to add rule:', err)
    }
  }

  async function handleDeleteRule() {
    if (!deleteRuleId) return

    try {
      await routing.removeRule(deleteRuleId)
      await loadRules()
    } catch (err) {
      console.error('Failed to delete rule:', err)
    } finally {
      setDeleteRuleId(null)
    }
  }

  function getProfileName(profileId: string): string {
    return profiles.find((p) => p.id === profileId)?.name ?? '未知应用'
  }

  function getPatternTypeLabel(type: string): string {
    switch (type) {
      case 'domain':
        return '域名'
      case 'prefix':
        return '前缀'
      case 'regex':
        return '正则'
      default:
        return type
    }
  }

  if (loading) {
    return (
      <div className="sectionContent">
        <div className="textMuted">加载中...</div>
      </div>
    )
  }

  return (
    <div className="sectionContent">
      {/* Add New Rule Form */}
      <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 8 }}>
        <div className="textSecondary" style={{ marginBottom: 12, fontWeight: 500 }}>
          添加新规则
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label className="textMuted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              匹配模式
            </label>
            <input
              type="text"
              className="input"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="例如: github.com"
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="textMuted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              类型
            </label>
            <select
              className="select"
              value={newPatternType}
              onChange={(e) => setNewPatternType(e.target.value as 'domain' | 'prefix' | 'regex')}
              style={{ width: '100%' }}
            >
              <option value="domain">域名</option>
              <option value="prefix">前缀</option>
              <option value="regex">正则</option>
            </select>
          </div>

          <div>
            <label className="textMuted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              目标应用
            </label>
            <select
              className="select"
              value={newProfileId}
              onChange={(e) => setNewProfileId(e.target.value)}
              style={{ width: '100%' }}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btnPrimary" onClick={handleAddRule} disabled={!newPattern.trim()}>
            <IconPlus style={{ width: 16, height: 16 }} />
            添加
          </button>
        </div>

        <div className="textMuted" style={{ fontSize: 11, marginTop: 8 }}>
          提示：域名匹配支持子域名（如 github.com 会匹配 api.github.com）
        </div>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="textMuted" style={{ textAlign: 'center', padding: 32 }}>
          <IconGlobe style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
          <div>暂无路由规则</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>添加规则后，点击链接时会自动在对应应用中打开</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-muted)'
                  }}
                >
                  匹配模式
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    width: 100
                  }}
                >
                  类型
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--text-muted)'
                  }}
                >
                  目标应用
                </th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>
                    <code
                      style={{
                        background: 'var(--bg-secondary)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 13
                      }}
                    >
                      {rule.pattern}
                    </code>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span
                      style={{
                        background: 'var(--bg-accent)',
                        color: 'var(--text-accent)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 500
                      }}
                    >
                      {getPatternTypeLabel(rule.patternType)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>{getProfileName(rule.profileId)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      className="btn btnSm btnGhost"
                      onClick={() => setDeleteRuleId(rule.id)}
                      title="删除规则"
                    >
                      <IconTrash style={{ width: 16, height: 16 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteRuleId !== null}
        title="删除路由规则"
        message="确定要删除这条路由规则吗？删除后，相关链接将不再自动路由到指定应用。"
        confirmText="删除"
        danger
        onClose={() => setDeleteRuleId(null)}
        onConfirm={handleDeleteRule}
      />
    </div>
  )
}
