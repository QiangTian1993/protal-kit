import { useState, useEffect } from 'react'
import { Modal } from './Modal'
import type { WebAppProfile } from '../../shared/types'

interface LinkRouterPromptProps {
  url: string
  profiles: WebAppProfile[]
  onSelect: (profileId: string, rememberChoice: boolean) => void
  onCancel: () => void
}

export function LinkRouterPrompt({ url, profiles, onSelect, onCancel }: LinkRouterPromptProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [rememberChoice, setRememberChoice] = useState(true)

  useEffect(() => {
    if (profiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profiles[0].id)
    }
  }, [profiles, selectedProfileId])

  const handleOpen = () => {
    if (selectedProfileId) {
      onSelect(selectedProfileId, rememberChoice)
    }
  }

  const domain = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  })()

  return (
    <Modal open={true} onClose={onCancel} title="选择应用打开链接" size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="textSecondary" style={{ fontSize: 14 }}>
          请选择用哪个应用打开此链接：
        </div>

        <div
          style={{
            background: 'var(--bg-secondary)',
            padding: 12,
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            maxHeight: 80,
            overflow: 'auto'
          }}
        >
          {url}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflow: 'auto' }}>
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => setSelectedProfileId(profile.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 12,
                borderRadius: 6,
                cursor: 'pointer',
                border: '2px solid',
                borderColor: selectedProfileId === profile.id ? 'var(--accent)' : 'var(--border)',
                background: selectedProfileId === profile.id ? 'var(--bg-accent)' : 'transparent',
                transition: 'all 0.15s'
              }}
            >
              {profile.icon?.value ? (
                <img
                  src={profile.icon.value}
                  alt={profile.name}
                  style={{ width: 24, height: 24, borderRadius: 4, marginRight: 12 }}
                />
              ) : (
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    marginRight: 12,
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  {profile.name.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>{profile.name}</div>
                <div className="textMuted" style={{ fontSize: 12, marginTop: 2 }}>
                  {new URL(profile.startUrl).hostname}
                </div>
              </div>
            </div>
          ))}
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            cursor: 'pointer',
            padding: '8px 0'
          }}
        >
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span>
            记住我的选择，自动为来自 <strong>{domain}</strong> 的链接使用此应用
          </span>
        </label>

        <div className="modalActions" style={{ marginTop: 8 }}>
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn btnPrimary" onClick={handleOpen} disabled={!selectedProfileId}>
            打开
          </button>
        </div>
      </div>
    </Modal>
  )
}
