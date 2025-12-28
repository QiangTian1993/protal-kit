export function newRequestId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function invoke<T>(channel: string, payload: Record<string, unknown>) {
  return window.portalKit.invoke(channel, { requestId: newRequestId(), ...payload }) as Promise<T>
}

