import type { WebContents } from 'electron'

type Notify = (channel: string, payload: unknown) => void

export function attachKeyboardShortcuts(webContents: WebContents, notify: Notify) {
  if (webContents.isDestroyed()) return

  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.alt) return

    const key = (input.key ?? '').toLowerCase()
    const cmdOrCtrl = process.platform === 'darwin' ? input.meta : input.control
    if (!cmdOrCtrl) return

    // App-level shortcuts (work even when focus is in BrowserView)
    if (!input.shift) {
      if (key === 'k') {
        event.preventDefault()
        notify('ui.commandPalette.toggle', {})
        return
      }
      if (key === 'b') {
        event.preventDefault()
        notify('ui.sidebar.toggle', {})
        return
      }
      if (key === ',') {
        event.preventDefault()
        notify('ui.settings.open', {})
        return
      }
    }

    if (input.shift && key === 'm') {
      event.preventDefault()
      notify('ui.immersive.toggle', {})
      return
    }

    // Profile navigation shortcuts: forward to renderer (reuse existing logic)
    if (!input.shift) {
      const isDigit = key.length === 1 && key >= '1' && key <= '9'
      const isNav = key === '[' || key === ']' || key === 'w'
      if (isDigit || isNav) {
        event.preventDefault()
        notify('ui.keyboard.shortcut', {
          key: input.key,
          altKey: Boolean(input.alt),
          ctrlKey: Boolean(input.control),
          metaKey: Boolean(input.meta),
          shiftKey: Boolean(input.shift)
        })
      }
    }
  })
}

