import { useState } from 'react'
import { invoke } from '../../lib/ipc/request'
import { ConfirmDialog } from '../../components/Modal'
import { IconTrash } from '../../components/Icons'

export function ClearData() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function clearAll() {
    await invoke('data.clear', { scope: 'all' })
    setStatus('已清理全部数据（会话/缓存）')
    setConfirmOpen(false)
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
        <button className="btn btnSm" onClick={() => setConfirmOpen(true)}>
          <IconTrash />
          清理
        </button>
      </div>

      {status && (
        <div className="textMuted" style={{ marginTop: 8, fontSize: 12 }}>
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
