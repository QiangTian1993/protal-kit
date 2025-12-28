import { readJsonFile, writeJsonFileAtomic } from './file-store'
import { appConfigSchema, defaultAppConfig, type AppConfig } from '../../shared/schemas/app-config'

export class AppConfigStore {
  constructor(private path: string) {}

  async load(): Promise<AppConfig> {
    const file = (await readJsonFile<AppConfig>(this.path)) ?? defaultAppConfig
    return appConfigSchema.parse(file)
  }

  async save(config: AppConfig): Promise<void> {
    const next = appConfigSchema.parse(config)
    await writeJsonFileAtomic(this.path, next)
  }

  async patch(patch: Partial<AppConfig>): Promise<AppConfig> {
    const current = await this.load()
    const next = appConfigSchema.parse({ ...current, ...patch })
    await this.save(next)
    return next
  }
}

