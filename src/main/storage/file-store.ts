import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const buf = await readFile(path, 'utf-8')
    return JSON.parse(buf) as T
  } catch (err: any) {
    if (err && err.code === 'ENOENT') return null
    throw err
  }
}

export async function writeJsonFileAtomic(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  const json = JSON.stringify(value, null, 2)
  await writeFile(tmp, json, 'utf-8')
  await rename(tmp, path)
}

