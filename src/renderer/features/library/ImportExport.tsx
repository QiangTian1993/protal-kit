import { useState } from 'react'
import { invoke } from '../../lib/ipc/request'
import { IconDownload, IconUpload } from '../../components/Icons'

export function ImportExport(props: { onImported: () => void | Promise<void> }) {
  const [status, setStatus] = useState<string | null>(null)

  async function onExport() {
    try {
      const res = await invoke<{ result: { profiles: unknown } }>('profiles.export', {})
      const data = JSON.stringify(res.result.profiles, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `portal-kit-profiles-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      setStatus('导出成功')
      setTimeout(() => setStatus(null), 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus(`导出失败：${message}`)
    }
  }

  async function onImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        await invoke('profiles.import', { profiles: parsed })
        setStatus('导入成功')
        await props.onImported()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setStatus(`导入失败：${message}`)
      }

      setTimeout(() => setStatus(null), 3000)
    }
    input.click()
  }

  return (
    <div className="flex itemsCenter gap2">
      <button className="btn btnSm" onClick={onExport}>
        <IconDownload />
        导出
      </button>
      <button className="btn btnSm" onClick={onImport}>
        <IconUpload />
        导入
      </button>
      {status && <span className="textMuted" style={{ fontSize: 12 }}>{status}</span>}
    </div>
  )
}
