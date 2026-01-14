import { useState } from 'react'
import { invokeResult } from '../../lib/ipc/request'
import { ConfirmDialog } from '../../components/Modal'
import { IconTrash } from '../../components/Icons'

export function ClearData() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  async function clearAll() {
    if (clearing) return
    try {
      setClearing(true)
      setStatus(null)
      setError(null)
      await invokeResult<{ cleared: boolean }>('data.clear', { scope: 'all' })
      setStatus('已清理全部数据（会话/缓存）')
      setConfirmOpen(false)
    } catch (err) {
      console.error('Failed to clear data:', err)
      setError(err instanceof Error ? err.message : '清理失败，请重试')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="sectionContent">
      <div className="flex itemsCenter justifyBetween">
        <div>
          <div className="textSecondary">清理所有应用数据</div>
          <div className="textMuted" style={{ fontSize: 11, marginTop: 2 }}>
            包括会话、缓存、Cookie 等，清理后需重新登录
          </div>
        </div>
        <button className="btn btnSm" onClick={() => setConfirmOpen(true)} disabled={clearing}>
          <IconTrash />
          {clearing ? '清理中…' : '清理'}
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--danger-color)',
            background: 'color-mix(in srgb, var(--danger-color) 14%, transparent)',
            padding: '8px 10px',
            borderRadius: 8
          }}
          aria-live="polite"
        >
          ✗ {error}
        </div>
      )}

      {status && (
        <div className="textMuted" style={{ marginTop: 8, fontSize: 12 }} aria-live="polite">
          ✓ {status}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="清理数据"
        message="确定要清理所有应用数据吗？这将清除所有 Web 应用的会话、缓存和 Cookie，你需要重新登录各个应用。"
        confirmText="清理"
        danger
        onClose={() => setConfirmOpen(false)}
        onConfirm={clearAll}
      />
    </div>
  )
}
