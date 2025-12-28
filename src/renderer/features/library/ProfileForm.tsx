import { useMemo, useState } from 'react'
import type { ExternalLinksPolicy, WebAppProfileInput } from '../../../shared/types'
import { Modal } from '../../components/Modal'

function isExternalLinksPolicy(value: string): value is ExternalLinksPolicy {
  return value === 'open-in-popup' || value === 'open-in-system' || value === 'block' || value === 'ask'
}

interface ProfileFormProps {
  initial: WebAppProfileInput
  existingGroups?: string[]
  onSubmit: (profile: WebAppProfileInput) => void | Promise<void>
}

function ProfileForm({ initial, existingGroups, onSubmit }: ProfileFormProps) {
  const [name, setName] = useState(initial.name)
  const [startUrl, setStartUrl] = useState(initial.startUrl)
  const [allowedOriginsText, setAllowedOriginsText] = useState(initial.allowedOrigins.join('\n'))
  const [policy, setPolicy] = useState<ExternalLinksPolicy>(initial.externalLinks.policy)
  const [iconPath, setIconPath] = useState(initial.icon?.type === 'file' ? initial.icon.value : '')
  const [group, setGroup] = useState(initial.group ?? '')
  const [pinned, setPinned] = useState(initial.pinned ?? true)
  const [submitting, setSubmitting] = useState(false)

  const allowedOrigins = useMemo(
    () =>
      allowedOriginsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [allowedOriginsText]
  )

  const canSubmit = name.trim().length > 0 && startUrl.trim().length > 0 && !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const normalizedGroup = group.trim()
      await onSubmit({
        ...initial,
        name: name.trim(),
        startUrl: startUrl.trim(),
        allowedOrigins,
        externalLinks: { policy },
        icon: iconPath ? { type: 'file', value: iconPath } : undefined,
        group: normalizedGroup ? normalizedGroup : undefined,
        pinned
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <div className="field">
        <label className="fieldLabel">名称</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：GitHub"
          autoFocus
        />
      </div>

      <div className="field">
        <label className="fieldLabel">入口 URL</label>
        <input
          className="input"
          type="url"
          value={startUrl}
          onChange={(e) => setStartUrl(e.target.value)}
          placeholder="https://example.com"
        />
      </div>

      <div className="field">
        <label className="fieldLabel">允许域名（可选，每行一个）</label>
        <textarea
          className="input"
          rows={3}
          value={allowedOriginsText}
          onChange={(e) => setAllowedOriginsText(e.target.value)}
          placeholder="https://example.com&#10;https://api.example.com"
        />
        <div className="textMuted" style={{ fontSize: 11 }}>
          留空表示仅允许入口 URL 的域名
        </div>
      </div>

      <div className="field">
        <label className="fieldLabel">应用图标（可选）</label>
        <div className="inputGroup">
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0]
              const path = (file as { path?: string } | undefined)?.path ?? ''
              setIconPath(path)
            }}
          />
          {iconPath && (
            <button className="btn" type="button" onClick={() => setIconPath('')}>
              清除
            </button>
          )}
        </div>
        <div className="textMuted" style={{ fontSize: 11 }}>
          {iconPath ? `已选择：${iconPath}` : '默认使用站点 favicon'}
        </div>
      </div>

      <div className="field">
        <label className="fieldLabel">分组（可选）</label>
        <input
          className="input"
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          placeholder="例如：工作"
          list={existingGroups && existingGroups.length > 0 ? 'profile-group-list' : undefined}
        />
        {existingGroups && existingGroups.length > 0 && (
          <datalist id="profile-group-list">
            {existingGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        )}
      </div>

      <div className="field">
        <label className="fieldLabel">外链策略</label>
        <select
          className="select"
          value={policy}
          onChange={(e) => {
            const next = e.target.value
            if (isExternalLinksPolicy(next)) setPolicy(next)
          }}
        >
          <option value="open-in-popup">在应用内弹窗打开（推荐）</option>
          <option value="open-in-system">在系统浏览器打开</option>
          <option value="block">阻止</option>
          <option value="ask">每次询问</option>
        </select>
        <div className="textMuted" style={{ fontSize: 11 }}>
          弹窗模式支持 OAuth 授权等需要保持登录状态的操作
        </div>
      </div>

      <div className="field">
        <label className="checkboxRow">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          固定到侧边栏
        </label>
      </div>

      <div className="modalActions">
        <button className="btn btnPrimary" type="submit" disabled={!canSubmit}>
          {submitting ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  )
}

interface ProfileFormModalProps {
  open: boolean
  title: string
  initial: WebAppProfileInput
  existingGroups?: string[]
  onClose: () => void
  onSubmit: (profile: WebAppProfileInput) => void | Promise<void>
}

export function ProfileFormModal({
  open,
  title,
  initial,
  existingGroups,
  onClose,
  onSubmit
}: ProfileFormModalProps) {
  async function handleSubmit(input: WebAppProfileInput) {
    await onSubmit(input)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <ProfileForm initial={initial} existingGroups={existingGroups} onSubmit={handleSubmit} />
    </Modal>
  )
}

export { ProfileForm }
