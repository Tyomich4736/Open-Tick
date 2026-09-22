/**
 * Rasterize resources/icon.svg → icon.png with transparent rounded corners.
 * Run: node scripts/rasterize-icon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'resources', 'icon.svg')
const outPath = join(root, 'resources', 'icon.png')

const svg = readFileSync(svgPath)
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 512 },
  background: 'rgba(0,0,0,0)',
})
const png = resvg.render().asPng()
writeFileSync(outPath, png)
console.log(`Wrote ${outPath} (${png.length} bytes)`)
