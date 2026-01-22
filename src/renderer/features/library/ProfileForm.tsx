import { useMemo, useState, type ReactNode } from 'react'
import type { AppProfileInput, ExternalLinksPolicy, NativeAppProfileInput, WebAppProfileInput } from '../../../shared/types'
import { nativeAppProfileInputSchema, webAppProfileInputSchema } from '../../../shared/schemas/profile'
import { Modal } from '../../components/Modal'

function isExternalLinksPolicy(value: string): value is ExternalLinksPolicy {
  return value === 'open-in-popup' || value === 'open-in-system' || value === 'block' || value === 'ask'
}

type AppType = 'web' | 'native'
type RuntimePlatform = 'mac' | 'windows' | 'linux' | 'unknown'

function detectPlatform(): RuntimePlatform {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function toOptionalString(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

interface ProfileFormProps {
  initial: AppProfileInput
  existingGroups?: string[]
  onSubmit: (profile: AppProfileInput) => void | Promise<void>
  extraFields?: ReactNode
}

function ProfileForm({ initial, existingGroups, onSubmit, extraFields }: ProfileFormProps) {
  const platform = detectPlatform()
  const initialType: AppType = initial.type === 'native' ? 'native' : 'web'
  const isEditing = typeof initial.id === 'string' && initial.id.trim().length > 0

  const initialWeb = initial.type === 'native' ? null : (initial as WebAppProfileInput)
  const initialNative = initial.type === 'native' ? (initial as NativeAppProfileInput) : null

  const [appType, setAppType] = useState<AppType>(initialType)

  const [name, setName] = useState(initial.name)
  const [startUrl, setStartUrl] = useState(initialWeb?.startUrl ?? '')
  const [allowedOriginsText, setAllowedOriginsText] = useState((initialWeb?.allowedOrigins ?? []).join('\n'))
  const [policy, setPolicy] = useState<ExternalLinksPolicy>(initialWeb?.externalLinks.policy ?? 'open-in-popup')
  const [iconPath, setIconPath] = useState(initial.icon?.type === 'file' ? initial.icon.value : '')
  const [group, setGroup] = useState(initial.group ?? '')
  const [pinned, setPinned] = useState(initial.pinned ?? true)
  const [executablePath, setExecutablePath] = useState(initialNative?.executable.path ?? '')
  const [bundleId, setBundleId] = useState(initialNative?.executable.bundleId ?? '')
  const [appName, setAppName] = useState(initialNative?.executable.appName ?? '')
  const [desktopEntry, setDesktopEntry] = useState(initialNative?.executable.desktopEntry ?? '')
  const [launchArgsText, setLaunchArgsText] = useState((initialNative?.launchArgs ?? []).join('\n'))
  const [workingDirectory, setWorkingDirectory] = useState(initialNative?.workingDirectory ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const allowedOrigins = useMemo(
    () =>
      allowedOriginsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    [allowedOriginsText]
  )

  const canSubmit =
    name.trim().length > 0 &&
    (appType === 'web' ? startUrl.trim().length > 0 : true) &&
    !submitting

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const normalizedGroup = group.trim()
      setErrors([])

      if (appType === 'web') {
        const base = (initial as WebAppProfileInput) ?? {}
        const candidate: WebAppProfileInput = {
          ...base,
          id: typeof base.id === 'string' && base.id.trim().length > 0 ? base.id : undefined,
          name: name.trim(),
          startUrl: startUrl.trim(),
          allowedOrigins,
          externalLinks: { policy },
          icon: iconPath ? { type: 'file', value: iconPath } : undefined,
          group: normalizedGroup ? normalizedGroup : undefined,
          pinned
        }

        const validated = webAppProfileInputSchema.safeParse(candidate)
        if (!validated.success) {
          setErrors(validated.error.issues.map((i) => i.message))
          return
        }

        await onSubmit(validated.data)
        return
      }

      const base = (initial as NativeAppProfileInput) ?? { type: 'native', name: '' }
      const launchArgs = launchArgsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      const candidate: NativeAppProfileInput = {
        ...base,
        type: 'native',
        id: typeof base.id === 'string' && base.id.trim().length > 0 ? base.id : undefined,
        name: name.trim(),
        executable: {
          path: toOptionalString(executablePath),
          bundleId: toOptionalString(bundleId),
          appName: toOptionalString(appName),
          desktopEntry: toOptionalString(desktopEntry)
        },
        launchArgs: launchArgs.length > 0 ? launchArgs : undefined,
        workingDirectory: toOptionalString(workingDirectory),
        icon: iconPath ? { type: 'file', value: iconPath } : undefined,
        group: normalizedGroup ? normalizedGroup : undefined,
        pinned
      }

      const validated = nativeAppProfileInputSchema.safeParse(candidate)
      if (!validated.success) {
        setErrors(validated.error.issues.map((i) => i.message))
        return
      }

      await onSubmit(validated.data)
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
        <label className="fieldLabel">应用类型</label>
        <select
          className="select"
          value={appType}
          onChange={(e) => {
            const next = e.target.value === 'native' ? 'native' : 'web'
            setAppType(next)
          }}
          disabled={isEditing}
        >
          <option value="web">Web 应用</option>
          <option value="native">原生应用</option>
        </select>
        {isEditing && (
          <div className="textMuted" style={{ fontSize: 11 }}>
            编辑时不支持修改应用类型
          </div>
        )}
      </div>

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

      {appType === 'web' ? (
        <>
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
        </>
      ) : (
        <>
          <div className="field">
            <label className="fieldLabel">启动配置</label>

            <div className="textMuted" style={{ fontSize: 11, marginBottom: 8 }}>
              当前平台：{platform === 'mac' ? 'macOS' : platform === 'windows' ? 'Windows' : platform === 'linux' ? 'Linux' : '未知'}
            </div>

            {(platform === 'mac' || platform === 'unknown') && (
              <div className="field" style={{ margin: 0 }}>
                <label className="fieldLabel" style={{ fontSize: 12 }}>
                  Bundle ID（macOS，可选）
                </label>
                <input
                  className="input"
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  placeholder="例如：com.apple.Safari"
                />
              </div>
            )}

            <div className="field" style={{ margin: platform === 'unknown' ? '8px 0 0' : '8px 0 0' }}>
              <label className="fieldLabel" style={{ fontSize: 12 }}>
                可执行路径（推荐）
              </label>
              <input
                className="input"
                value={executablePath}
                onChange={(e) => setExecutablePath(e.target.value)}
                placeholder={
                  platform === 'windows'
                    ? '例如：C:/Program Files/...\u2026/Code.exe'
                    : platform === 'mac'
                      ? '例如：/Applications/Visual Studio Code.app'
                      : '例如：/usr/bin/code'
                }
              />
            </div>

            {(platform === 'windows' || platform === 'unknown') && (
              <div className="field" style={{ margin: '8px 0 0' }}>
                <label className="fieldLabel" style={{ fontSize: 12 }}>
                  应用名称（Windows，可选）
                </label>
                <input
                  className="input"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="例如：Visual Studio Code"
                />
              </div>
            )}

            {(platform === 'linux' || platform === 'unknown') && (
              <div className="field" style={{ margin: '8px 0 0' }}>
                <label className="fieldLabel" style={{ fontSize: 12 }}>
                  Desktop Entry（Linux，可选）
                </label>
                <input
                  className="input"
                  value={desktopEntry}
                  onChange={(e) => setDesktopEntry(e.target.value)}
                  placeholder="例如：code.desktop 或 org.gnome.Terminal"
                />
              </div>
            )}
          </div>

          <div className="field">
            <label className="fieldLabel">启动参数（可选，每行一个）</label>
            <textarea
              className="input"
              rows={3}
              value={launchArgsText}
              onChange={(e) => setLaunchArgsText(e.target.value)}
              placeholder="例如：--profile-directory=Default"
            />
          </div>

          <div className="field">
            <label className="fieldLabel">工作目录（可选）</label>
            <input
              className="input"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder="例如：/Users/you/workspace"
            />
          </div>
        </>
      )}

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
          {iconPath ? `已选择：${iconPath}` : appType === 'web' ? '默认使用站点 favicon' : '未选择图标'}
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
        <label className="checkboxRow">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          固定到侧边栏
        </label>
      </div>

      {extraFields}

      {errors.length > 0 && (
        <div className="field">
          <div className="textMuted" style={{ fontSize: 12, color: 'var(--danger, #c0392b)' }}>
            {errors.map((err) => (
              <div key={err}>{err}</div>
            ))}
          </div>
        </div>
      )}

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
  initial: AppProfileInput
  existingGroups?: string[]
  extraFields?: ReactNode
  onClose: () => void
  onSubmit: (profile: AppProfileInput) => void | Promise<void>
}

export function ProfileFormModal({
  open,
  title,
  initial,
  existingGroups,
  extraFields,
  onClose,
  onSubmit
}: ProfileFormModalProps) {
  async function handleSubmit(input: AppProfileInput) {
    await onSubmit(input)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <ProfileForm initial={initial} existingGroups={existingGroups} onSubmit={handleSubmit} extraFields={extraFields} />
    </Modal>
  )
}

export { ProfileForm }
