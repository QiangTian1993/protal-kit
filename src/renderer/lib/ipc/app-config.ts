import { invoke } from './request'
import type { AppConfig } from '../../../shared/schemas/app-config'

export async function getAppConfig() {
  return invoke<AppConfig>('app.config.get', {})
}

export async function setLanguage(language: AppConfig['language']) {
  return invoke<AppConfig>('app.config.setLanguage', { language })
}

export async function setWindowInitialSize(window: {
  initialWidth?: number | null
  initialHeight?: number | null
}) {
  return invoke<AppConfig>('app.config.setWindowInitialSize', { window })
}
