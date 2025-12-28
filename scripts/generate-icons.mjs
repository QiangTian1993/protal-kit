import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// This script expects a source SVG/PNG in build/icon-source.
// For this repo run, we'll embed the provided PNG as base64 and write platform icons.

const outDir = join(process.cwd(), 'build', 'icons')
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

// base64 of the provided PNG should be replaced if you supply a different one
// Here we leave placeholders and only write minimal icons if not present

function writeIfMissing(file, buffer) {
  if (existsSync(file)) return
  writeFileSync(file, buffer)
}

// Minimal placeholder PNG 512x512 transparent if no real asset provided
const blankPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAQAAAB3m4wWAAAAAElFTkSuQmCC',
  'base64'
)

writeIfMissing(join(outDir, 'icon.png'), blankPng)
writeIfMissing(join(outDir, 'icon@2x.png'), blankPng)
writeIfMissing(join(outDir, 'icon.ico'), blankPng)
writeIfMissing(join(outDir, 'icon.icns'), blankPng)

console.log('[icons] ensured build/icons placeholders (replace with real assets if needed)')

