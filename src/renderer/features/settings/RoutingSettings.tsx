import { useState, useEffect, useMemo } from 'react'
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
  const [patternError, setPatternError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [newPattern, setNewPattern] = useState('')
  const [newPatternType, setNewPatternType] = useState<'domain' | 'prefix' | 'regex'>('domain')
  const [newProfileId, setNewProfileId] = useState('')
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)

  const profileMap = useMemo(() => {
    return new Map(profiles.map((p) => [p.id, p.name]))
  }, [profiles])

  useEffect(() => {
    void loadRules()
  }, [])

  useEffect(() => {
    if (profiles.length === 0) return
    if (newProfileId && profiles.some((p) => p.id === newProfileId)) return
    setNewProfileId(profiles[0].id)
  }, [profiles, newProfileId])

  async function loadRules() {
    try {
      setLoading(true)
      setFormError(null)
      const fetchedRules = await routing.getRules()
      setRules(fetchedRules)
    } catch (err) {
      console.error('Failed to load routing rules:', err)
      setFormError(err instanceof Error ? err.message : '加载路由规则失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddRule() {
    setPatternError(null)
    setFormError(null)

    if (!newPattern.trim()) {
      setPatternError('请输入匹配模式')
      return
    }

    if (!newProfileId) {
      setFormError('请选择目标应用')
      return
    }

    if (newPatternType === 'regex') {
      try {
        new RegExp(newPattern.trim())
      } catch (err) {
        console.error('Invalid regex pattern:', err)
        const errorMsg = err instanceof Error ? err.message : '未知错误'
        setPatternError(`正则表达式格式错误：${errorMsg}`)
        return
      }
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
      setFormError(err instanceof Error ? err.message : '添加规则失败，请重试')
    }
  }

  async function handleDeleteRule() {
    if (!deleteRuleId) return

    try {
      setFormError(null)
      await routing.removeRule(deleteRuleId)
      await loadRules()
    } catch (err) {
      console.error('Failed to delete rule:', err)
      setFormError(err instanceof Error ? err.message : '删除规则失败，请重试')
    } finally {
      setDeleteRuleId(null)
    }
  }

  function getProfileName(profileId: string): string {
    return profileMap.get(profileId) ?? '未知应用'
  }

  function getPatternTypeLabel(type: RoutingRule['patternType']): string {
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
      <div
        style={{
          marginBottom: 24,
          padding: 16,
          background: 'var(--surface-soft)',
          border: '1px solid var(--border-color)',
          borderRadius: 12
        }}
      >
        <div className="textSecondary" style={{ marginBottom: 16, fontWeight: 500 }}>
          添加新规则
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="textMuted" htmlFor="routing-pattern" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              匹配模式
            </label>
            <input
              id="routing-pattern"
              type="text"
              className="input"
              value={newPattern}
              onChange={(e) => {
                setPatternError(null)
                setFormError(null)
                setNewPattern(e.target.value)
              }}
              placeholder="例如: github.com"
              style={{
                width: '100%',
                borderColor: patternError ? 'var(--danger-color)' : undefined
              }}
              aria-invalid={Boolean(patternError)}
              aria-describedby={patternError ? 'pattern-error' : undefined}
            />
            {patternError && (
              <div id="pattern-error" style={{ fontSize: 11, color: 'var(--danger-color)', marginTop: 4 }}>
                ⚠️ {patternError}
              </div>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 2fr auto',
              gap: 12,
              alignItems: 'end'
            }}
          >
            <div>
              <label className="textMuted" htmlFor="routing-pattern-type" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                类型
              </label>
              <select
                id="routing-pattern-type"
                className="select"
                value={newPatternType}
                onChange={(e) => {
                  setPatternError(null)
                  setFormError(null)
                  setNewPatternType(e.target.value as 'domain' | 'prefix' | 'regex')
                }}
                style={{ width: '100%' }}
              >
                <option value="domain">域名</option>
                <option value="prefix">前缀</option>
                <option value="regex">正则</option>
              </select>
            </div>

            <div>
              <label className="textMuted" htmlFor="routing-target-app" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                目标应用
              </label>
              <select
                id="routing-target-app"
                className="select"
                value={newProfileId}
                onChange={(e) => {
                  setFormError(null)
                  setNewProfileId(e.target.value)
                }}
                style={{ width: '100%' }}
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id} title={profile.name}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn btnPrimary"
              type="button"
              onClick={handleAddRule}
              disabled={!newPattern.trim() || !newProfileId}
              style={{ whiteSpace: 'nowrap' }}
            >
              <IconPlus style={{ width: 16, height: 16 }} />
              添加规则
            </button>
          </div>

          {formError && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--danger-color)',
                padding: '8px 12px',
                background: 'color-mix(in srgb, var(--danger-color) 10%, transparent)',
                borderRadius: 6
              }}
              aria-live="polite"
            >
              ✗ {formError}
            </div>
          )}

          <div className="textMuted" style={{ fontSize: 11 }}>
            提示：域名匹配支持子域名（如 github.com 会匹配 api.github.com）
          </div>
        </div>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="textMuted" style={{ textAlign: 'center', padding: 48 }}>
          <IconGlobe style={{ width: 64, height: 64, margin: '0 auto 16px', opacity: 0.2 }} />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: 'var(--text-secondary)' }}>
            创建你的第一条路由规则
          </div>
          <div style={{ fontSize: 13, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            使用上方的表单，可以指定域名或 URL 前缀，将链接自动在特定应用中打开。例如，将所有 github.com 的链接在 GitHub
            应用中打开。
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-soft)' }}>
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
                <tr key={rule.id} className="routingRuleRow" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14 }}>
                    <code
                      style={{
                        background: 'var(--pill-bg)',
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
                        background: 'color-mix(in srgb, var(--accent-color) 16%, transparent)',
                        color: 'var(--accent-color)',
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
                      type="button"
                      onClick={() => setDeleteRuleId(rule.id)}
                      title="删除规则"
                      aria-label={`删除规则 ${rule.pattern}`}
                      style={{ color: 'var(--danger-color)' }}
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
