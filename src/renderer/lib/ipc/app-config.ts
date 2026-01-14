import { invokeResult } from './request'
import type { AppConfig } from '../../../shared/schemas/app-config'

export async function getAppConfig(): Promise<AppConfig> {
  return invokeResult<AppConfig>('app.config.get')
}

export async function setLanguage(language: AppConfig['language']): Promise<AppConfig> {
  return invokeResult<AppConfig>('app.config.setLanguage', { language })
}

export async function setWindowInitialSize(window: {
  initialWidth?: number | null
  initialHeight?: number | null
}): Promise<AppConfig> {
  return invokeResult<AppConfig>('app.config.setWindowInitialSize', { window })
}
