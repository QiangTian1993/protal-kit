import { invoke } from './request'

export type MenuAction =
  | 'about'
  | 'quit'
  | 'reload'
  | 'toggleDevTools'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAndMatchStyle'
  | 'delete'
  | 'selectAll'

export async function runMenuAction(action: MenuAction) {
  await invoke<{ result: { ok: boolean } }>('app.menu.action', { action })
}

