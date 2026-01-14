export function newRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function invoke<T>(channel: string, payload: Record<string, unknown> = {}) {
  return window.portalKit.invoke(channel, { requestId: newRequestId(), ...payload }) as Promise<T>
}

/**
 * 发送 IPC 请求并自动解包 result 字段
 * 用于处理主进程返回 { requestId, result: T } 格式的响应
 */
export async function invokeResult<T>(channel: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await invoke<{ requestId: string; result: T }>(channel, payload)
  return response.result
}
