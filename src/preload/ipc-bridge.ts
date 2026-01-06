import { contextBridge, ipcRenderer } from 'electron'

type IpcInvoke = (channel: string, payload: any) => Promise<any>
type IpcUnsubscribe = () => void

const invoke: IpcInvoke = (channel, payload) => ipcRenderer.invoke(channel, payload)

const allowedEventChannels = new Set([
  'ui.sidebar.toggle',
  'ui.settings.drawer',
  'ui.language.changed',
  'ui.immersive.toggle',
  'ui.library.navigate',
  'profiles.changed',
  'workspace.activeChanged',
  'webapp.loading',
  'webapp.loaded',
  'webapp.loadFailed',
  'linkRouter.prompt',
  'linkRouter.autoMatched',
  'webapp.hibernated',
  'webapp.restored'
])

function on(channel: string, handler: (payload: any) => void): IpcUnsubscribe {
  if (!allowedEventChannels.has(channel)) throw new Error(`event_channel_not_allowed:${channel}`)
  const listener = (_event: unknown, payload: any) => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('portalKit', { invoke, on })

declare global {
  interface Window {
    portalKit: { invoke: IpcInvoke; on: (channel: string, handler: (payload: any) => void) => IpcUnsubscribe }
  }
}
