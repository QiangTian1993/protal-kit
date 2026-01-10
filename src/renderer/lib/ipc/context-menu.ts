import { invoke, newRequestId } from './request'

export type ContextMenuPopupItem =
  | {
      type?: 'item'
      id: string
      label: string
      disabled?: boolean
      danger?: boolean
    }
  | {
      type: 'separator'
      id: string
    }

export async function popupContextMenu(args: {
  position: { x: number; y: number }
  items: ContextMenuPopupItem[]
}): Promise<string | null> {
  const menuRequestId = newRequestId()

  return new Promise((resolve) => {
    let settled = false
    const cleanup = () => {
      unsubSelect()
      unsubClosed()
      settled = true
    }

    const unsubSelect = window.portalKit.on(
      'ui.contextMenu.select',
      (payload: { menuRequestId: string; itemId: string }) => {
        if (payload.menuRequestId !== menuRequestId) return
        if (settled) return
        cleanup()
        resolve(payload.itemId)
      }
    )

    const unsubClosed = window.portalKit.on(
      'ui.contextMenu.closed',
      (payload: { menuRequestId: string }) => {
        if (payload.menuRequestId !== menuRequestId) return
        if (settled) return
        cleanup()
        resolve(null)
      }
    )

    void invoke<{ result: { shown: boolean } }>('app.contextMenu.popup', {
      menuRequestId,
      position: { x: Math.round(args.position.x), y: Math.round(args.position.y) },
      items: args.items
    }).catch(() => {
      if (settled) return
      cleanup()
      resolve(null)
    })

    setTimeout(() => {
      if (settled) return
      cleanup()
      resolve(null)
    }, 30_000)
  })
}

