import { useEffect, useMemo, useState } from 'react'
import type { AppConfig } from '../../../shared/schemas/app-config'
import { getAppConfig, setWindowInitialSize } from '../../lib/ipc/app-config'

type FieldState = { value: string; error: string | null }

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
  const [width, setWidth] = useState<FieldState>({ value: '', error: null })
  const [height, setHeight] = useState<FieldState>({ value: '', error: null })
  const [saving, setSaving] = useState(false)
  const [selection, setSelection] = useState<WindowSizeSelection>('auto')

  const hasCustom = Boolean(config?.window?.initialWidth || config?.window?.initialHeight)

  function applyConfig(cfg: AppConfig) {
    setConfig(cfg)
    setSelection(deriveSelectionFromConfig(cfg))
    setWidth({ value: formatOptionalNumber(cfg.window?.initialWidth), error: null })
    setHeight({ value: formatOptionalNumber(cfg.window?.initialHeight), error: null })
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true)
        const cfg = await getAppConfig()
        applyConfig(cfg)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const validation = useMemo(() => {
    const widthValue = parsePositiveInt(width.value)
    const heightValue = parsePositiveInt(height.value)

    const widthError =
      width.value.trim().length === 0
        ? null
        : widthValue === null
          ? '请输入整数'
          : widthValue < 800
            ? '最小宽度为 800px'
            : null

    const heightError =
      height.value.trim().length === 0
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
  }, [height.value, width.value])

  async function refresh() {
    const cfg = await getAppConfig()
    applyConfig(cfg)
  }

  function handleSelectionChange(next: WindowSizeSelection) {
    setStatus(null)
    setSelection(next)

    if (next === 'auto') {
      setWidth({ value: '', error: null })
      setHeight({ value: '', error: null })
      return
    }

    if (next === 'custom') return

    const preset = WINDOW_SIZE_PRESETS.find((p) => p.id === next)
    if (!preset) return

    setWidth({ value: String(preset.width), error: null })
    setHeight({ value: String(preset.height), error: null })
  }

  async function handleSave() {
    setStatus(null)
    const nextWidthError = validation.widthError
    const nextHeightError = validation.heightError
    setWidth((prev) => ({ ...prev, error: nextWidthError }))
    setHeight((prev) => ({ ...prev, error: nextHeightError }))
    if (!validation.canSave) return

    try {
      setSaving(true)
      await setWindowInitialSize({
        initialWidth: validation.widthValue ?? null,
        initialHeight: validation.heightValue ?? null
      })
      await refresh()
      setStatus('已保存，下次启动生效')
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setStatus(null)
    try {
      setSaving(true)
      await setWindowInitialSize({ initialWidth: null, initialHeight: null })
      await refresh()
      setStatus('已恢复默认（自动）')
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
      <div className="flex itemsCenter justifyBetween">
        <div>
          <div className="textSecondary">初始窗口大小</div>
          <div className="textMuted" style={{ fontSize: 11, marginTop: 2 }}>
            仅影响启动时初始尺寸（单位：px），保存后下次启动生效
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btnSm" type="button" onClick={() => void handleSave()} disabled={saving}>
            保存
          </button>
          <button className="btn btnSm btnGhost" type="button" onClick={() => void handleReset()} disabled={saving || !hasCustom}>
            恢复默认
          </button>
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
              value={width.value}
              onChange={(e) => {
                setStatus(null)
                setWidth({ value: e.target.value, error: null })
              }}
              onBlur={() => setWidth((prev) => ({ ...prev, error: validation.widthError }))}
              aria-invalid={Boolean(validation.widthError)}
            />
            {validation.widthError && (
              <div style={{ fontSize: 12, color: 'var(--danger-color)', marginTop: 4 }}>{validation.widthError}</div>
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
              value={height.value}
              onChange={(e) => {
                setStatus(null)
                setHeight({ value: e.target.value, error: null })
              }}
              onBlur={() => setHeight((prev) => ({ ...prev, error: validation.heightError }))}
              aria-invalid={Boolean(validation.heightError)}
            />
            {validation.heightError && (
              <div style={{ fontSize: 12, color: 'var(--danger-color)', marginTop: 4 }}>{validation.heightError}</div>
            )}
          </div>
        </div>
      )}

      {status && (
        <div className="textMuted" style={{ marginTop: 10, fontSize: 12 }}>
          ✓ {status}
        </div>
      )}
    </div>
  )
}
