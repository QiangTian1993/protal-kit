import type { NativeAppProfile } from '../../../shared/types'
import { invoke } from './request'

type Ok<T> = { success: true; data: T }
type Err = { success: false; error: string }
type Result<T> = Ok<T> | Err

/**
 * 原生应用 IPC（渲染进程）封装喵～
 *
 * 约定：主进程返回 `{ requestId, result: { success, data | error } }`。
 * 本模块在 `success: false` 时抛出 Error，便于上层统一处理。
 */
export type NativeAppRuntimeState = {
  processId?: number
  isRunning: boolean
  lastActivatedAt?: string
  launchError?: string
}

async function invokeNative<T>(channel: string, payload: Record<string, unknown> = {}): Promise<T> {
  const res = await invoke<{ result: Result<T> }>(channel, payload)
  if (res.result.success) return res.result.data
  throw new Error(res.result.error)
}

export async function launchNativeApp(profileId: string): Promise<void> {
  await invokeNative('nativeApps.launch', { profileId })
}

export async function closeNativeApp(profileId: string): Promise<void> {
  await invokeNative('nativeApps.close', { profileId })
}

export async function switchToNativeApp(profileId: string): Promise<void> {
  await invokeNative('nativeApps.switch', { profileId })
}

export async function getNativeAppState(profileId: string): Promise<NativeAppRuntimeState> {
  const data = await invokeNative<{ state: NativeAppRuntimeState }>('nativeApps.getState', { profileId })
  return data.state
}

export async function listNativeApps(): Promise<Array<{ profile: NativeAppProfile; state: NativeAppRuntimeState }>> {
  const data = await invokeNative<{ profiles: Array<{ profile: NativeAppProfile; state: NativeAppRuntimeState }> }>(
    'nativeApps.list',
    {}
  )
  return data.profiles
}
