import type { IpcMain } from 'electron'
import type { NativeAppProfile } from '../../../shared/types'
import type { IpcContext } from '../router'

type Ok<T> = { success: true; data: T }
type Err = { success: false; error: string }
type Result<T> = Ok<T> | Err
type Empty = Record<string, never>

/**
 * 原生应用 IPC Handler（主进程）喵～
 *
 * 统一返回格式：`{ requestId, result: { success, data | error } }`
 *
 * 支持的 channel：
 * - `nativeApps.launch`：启动（或打开）原生应用
 * - `nativeApps.switch`：切换/置前原生应用
 * - `nativeApps.close`：关闭原生应用
 * - `nativeApps.getState`：查询运行状态
 * - `nativeApps.list`：列出所有原生应用及其运行状态
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function parseProfileId(profileId: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof profileId !== 'string') return { ok: false, error: '参数错误：profileId 必须是字符串' }
  const value = profileId.trim()
  if (value.length === 0) return { ok: false, error: '参数错误：profileId 不能为空' }
  return { ok: true, value }
}

async function findNativeProfile(ctx: IpcContext, profileId: string): Promise<NativeAppProfile | null> {
  const profiles = await ctx.profiles.listNativeAppProfiles()
  return profiles.find((p) => p.id === profileId) ?? null
}

/**
 * 注册原生应用相关 IPC handler 喵～
 *
 * 依赖：
 * - `ctx.appManager`：统一应用管理器（负责 open/switch/close）
 * - `ctx.nativeApps`：NativeAppManager（负责状态查询）
 */
export function registerNativeAppsHandlers(ipc: IpcMain, ctx: IpcContext) {
  const respond = async <T>(
    payload: { requestId: string },
    fn: () => Promise<Result<T>>
  ): Promise<{ requestId: string; result: Result<T> }> => {
    try {
      const result = await fn()
      return { requestId: payload.requestId, result }
    } catch (err) {
      return { requestId: payload.requestId, result: { success: false, error: getErrorMessage(err) } }
    }
  }

  const handle = <T, P extends { requestId: string }>(channel: string, handler: (payload: P) => Promise<Result<T>>) => {
    ipc.handle(channel, async (_event, payload: P) => {
      return await respond(payload, async () => {
        if (!ctx.appManager || !ctx.nativeApps) {
          return { success: false, error: '原生应用功能未初始化' }
        }
        return await handler(payload)
      })
    })
  }

  const launch = async (payload: { requestId: string; profileId: unknown }): Promise<Result<Empty>> => {
    const parsed = parseProfileId(payload.profileId)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const profileId = parsed.value
    const nativeProfile = await findNativeProfile(ctx, profileId)
    if (!nativeProfile) return { success: false, error: `native_profile_not_found:${profileId}` }

    ctx.logger.info('nativeApps.ipc.launch', { profileId })
    await ctx.appManager!.openProfile(profileId)
    ctx.notify('workspace.activeChanged', { profileId })
    return { success: true, data: {} }
  }
  handle('nativeApps.launch', launch)
  handle('launch-native-app', launch)

  const close = async (payload: { requestId: string; profileId: unknown }): Promise<Result<Empty>> => {
    const parsed = parseProfileId(payload.profileId)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const profileId = parsed.value
    const nativeProfile = await findNativeProfile(ctx, profileId)
    if (!nativeProfile) return { success: false, error: `native_profile_not_found:${profileId}` }

    ctx.logger.info('nativeApps.ipc.close', { profileId })
    await ctx.appManager!.closeProfile(profileId)
    return { success: true, data: {} }
  }
  handle('nativeApps.close', close)
  handle('close-native-app', close)

  const switchTo = async (payload: { requestId: string; profileId: unknown }): Promise<Result<Empty>> => {
    const parsed = parseProfileId(payload.profileId)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const profileId = parsed.value
    const nativeProfile = await findNativeProfile(ctx, profileId)
    if (!nativeProfile) return { success: false, error: `native_profile_not_found:${profileId}` }

    ctx.logger.info('nativeApps.ipc.switch', { profileId })
    await ctx.appManager!.switchToProfile(profileId)
    ctx.notify('workspace.activeChanged', { profileId })
    return { success: true, data: {} }
  }
  handle('nativeApps.switch', switchTo)
  handle('switch-to-native-app', switchTo)

  const getState = async (
    payload: { requestId: string; profileId: unknown }
  ): Promise<Result<{ state: unknown }>> => {
    const parsed = parseProfileId(payload.profileId)
    if (!parsed.ok) return { success: false, error: parsed.error }
    const profileId = parsed.value
    const nativeProfile = await findNativeProfile(ctx, profileId)
    if (!nativeProfile) return { success: false, error: `native_profile_not_found:${profileId}` }

    const state = ctx.nativeApps!.getAppState(profileId)
    return { success: true, data: { state } }
  }
  handle('nativeApps.getState', getState)
  handle('get-native-app-state', getState)

  const list = async (
    _payload: { requestId: string }
  ): Promise<Result<{ profiles: Array<{ profile: NativeAppProfile; state: unknown }> }>> => {
    const profiles = await ctx.profiles.listNativeAppProfiles()
    const rows = profiles.map((profile) => ({ profile, state: ctx.nativeApps!.getAppState(profile.id) }))
    return { success: true, data: { profiles: rows } }
  }
  handle('nativeApps.list', list)
  handle('list-native-apps', list)
}
