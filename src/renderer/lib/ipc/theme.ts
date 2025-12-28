import { invoke } from './request'

export type ThemeMode = 'system' | 'light' | 'dark'

export async function setThemeSource(mode: ThemeMode) {
  return invoke<{ applied: boolean; mode: ThemeMode }>('app.theme.set', { mode })
}
