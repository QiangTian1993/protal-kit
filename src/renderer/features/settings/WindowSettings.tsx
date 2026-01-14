import { useEffect, useMemo, useState } from 'react'
import type { AppConfig } from '../../../shared/schemas/app-config'
import { getAppConfig, setWindowInitialSize } from '../../lib/ipc/app-config'

const WINDOW_SIZE_PRESETS = [
  { id: '1000x700', label: '1000×700', width: 1000, height: 700 },
  { id: '1280x800', label: '1280×800', width: 1280, height: 800 },
  { id: '1440x900', label: '1440×900', width: 1440, height: 900 },
  { id: '1920x1080', label: '1920×1080', width: 1920, height: 1080 }
] as const

type WindowSizePreset = (typeof WINDOW_SIZE_PRESETS)[number]
type WindowSizeSelection = 'auto' | 'custom' | WindowSizePreset['id']

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return null
  const n = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(n)) return null
  return n
}

function formatOptionalNumber(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : ''
}

function deriveSelectionFromConfig(cfg: AppConfig): WindowSizeSelection {
  const w = cfg.window?.initialWidth
  const h = cfg.window?.initialHeight
  if (typeof w !== 'number' && typeof h !== 'number') return 'auto'
  if (typeof w === 'number' && typeof h === 'number') {
    const matched = WINDOW_SIZE_PRESETS.find((p) => p.width === w && p.height === h)
    if (matched) return matched.id
  }
  return 'custom'
}

export function WindowSettings() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selection, setSelection] = useState<WindowSizeSelection>('auto')

  const hasCustom = Boolean(config?.window?.initialWidth || config?.window?.initialHeight)

  function applyConfig(cfg: AppConfig) {
    setConfig(cfg)
    setSelection(deriveSelectionFromConfig(cfg))
    setWidth(formatOptionalNumber(cfg.window?.initialWidth))
    setHeight(formatOptionalNumber(cfg.window?.initialHeight))
    setShowValidation(false)
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)
        setError(null)
        const cfg = await getAppConfig()
        applyConfig(cfg)
      } catch (err) {
        console.error('Failed to load app config:', err)
        setError(err instanceof Error ? err.message : '加载失败，请重试')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const validation = useMemo(() => {
    const widthValue = parsePositiveInt(width)
    const heightValue = parsePositiveInt(height)

    const widthError =
      width.trim().length === 0
        ? null
        : widthValue === null
          ? '请输入整数'
          : widthValue < 800
            ? '最小宽度为 800px'
            : null

    const heightError =
      height.trim().length === 0
        ? null
        : heightValue === null
          ? '请输入整数'
          : heightValue < 600
            ? '最小高度为 600px'
            : null

    return {
      widthValue,
      heightValue,
      widthError,
      heightError,
      canSave: widthError === null && heightError === null
    }
  }, [height, width])

  const displayWidthError = showValidation ? validation.widthError : null
  const displayHeightError = showValidation ? validation.heightError : null

  async function refresh() {
    const cfg = await getAppConfig()
    applyConfig(cfg)
  }

  function handleSelectionChange(next: WindowSizeSelection) {
    setStatus(null)
    setError(null)
    setSelection(next)
    setShowValidation(false)

    if (next === 'auto') {
      setWidth('')
      setHeight('')
      return
    }

    if (next === 'custom') return

    const preset = WINDOW_SIZE_PRESETS.find((p) => p.id === next)
    if (!preset) return

    setWidth(String(preset.width))
    setHeight(String(preset.height))
  }

  async function handleSave() {
    setStatus(null)
    setError(null)
    setShowValidation(true)
    if (!validation.canSave) return

    try {
      setSaving(true)
      await setWindowInitialSize({
        initialWidth: validation.widthValue ?? null,
        initialHeight: validation.heightValue ?? null
      })
      await refresh()
      setStatus('已保存，下次启动生效')
    } catch (err) {
      console.error('Failed to save window size:', err)
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setStatus(null)
    setError(null)
    try {
      setSaving(true)
      await setWindowInitialSize({ initialWidth: null, initialHeight: null })
      await refresh()
      setStatus('已恢复默认（自动）')
    } catch (err) {
      console.error('Failed to reset window size:', err)
      setError(err instanceof Error ? err.message : '恢复默认失败，请重试')
    } finally {
      setSaving(false)
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
      <div>
        <div className="textSecondary">初始窗口大小</div>
        <div className="textMuted" style={{ fontSize: 11, marginTop: 2 }}>
          仅影响启动时初始尺寸（单位：px），保存后下次启动生效
        </div>
      </div>

      <div className="flex itemsCenter justifyBetween" style={{ marginTop: 12 }}>
        <label className="textSecondary" htmlFor="window-initial-size-selection">
          选择
        </label>
        <select
          id="window-initial-size-selection"
          className="select"
          value={selection}
          onChange={(e) => handleSelectionChange(e.target.value as WindowSizeSelection)}
        >
          <option value="auto">自动</option>
          <optgroup label="预设">
            {WINDOW_SIZE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </optgroup>
          <option value="custom">自定义</option>
        </select>
      </div>

      {selection === 'custom' && (
        <div className="inputGroup" style={{ marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="fieldLabel" htmlFor="window-initial-width">
              宽度
            </label>
            <input
              id="window-initial-width"
              className="input"
              inputMode="numeric"
              placeholder="自动"
              value={width}
              onChange={(e) => {
                setStatus(null)
                setError(null)
                setWidth(e.target.value)
              }}
              onBlur={() => setShowValidation(true)}
              aria-invalid={Boolean(displayWidthError)}
            />
            {displayWidthError && (
              <div style={{ fontSize: 12, color: 'var(--danger-color)', marginTop: 4 }}>{displayWidthError}</div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <label className="fieldLabel" htmlFor="window-initial-height">
              高度
            </label>
            <input
              id="window-initial-height"
              className="input"
              inputMode="numeric"
              placeholder="自动"
              value={height}
              onChange={(e) => {
                setStatus(null)
                setError(null)
                setHeight(e.target.value)
              }}
              onBlur={() => setShowValidation(true)}
              aria-invalid={Boolean(displayHeightError)}
            />
            {displayHeightError && (
              <div style={{ fontSize: 12, color: 'var(--danger-color)', marginTop: 4 }}>{displayHeightError}</div>
            )}
          </div>
        </div>
      )}

      {status && (
        <div className="textMuted" style={{ marginTop: 10, fontSize: 12 }} aria-live="polite">
          ✓ {status}
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10,
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

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--border-color)'
        }}
      >
        <button
          className="btn btnSm btnGhost"
          type="button"
          onClick={() => void handleReset()}
          disabled={saving || !hasCustom}
        >
          恢复默认
        </button>
        <button
          className="btn btnSm btnPrimary"
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
