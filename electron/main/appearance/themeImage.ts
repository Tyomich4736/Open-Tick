import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, dialog, nativeImage } from 'electron'
import type { ThemeColors } from '@shared/appearance'
import { DEFAULT_LIGHT_COLORS } from '@shared/appearance'

function themesDir(): string {
  const dir = join(app.getPath('userData'), 'themes')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
}

/** Sample nativeImage bitmap and derive a usable ThemeColors set */
export function extractPaletteFromImage(filePath: string): ThemeColors {
  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) {
    return { ...DEFAULT_LIGHT_COLORS }
  }

  const { width, height } = image.getSize()
  const maxEdge = 120
  const scale = Math.min(1, maxEdge / Math.max(width, height, 1))
  const resized = image.resize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  })

  const bitmap = resized.toBitmap()
  const size = resized.getSize()
  const samples: [number, number, number][] = []

  // BGRA buffer from Electron nativeImage
  for (let y = 0; y < size.height; y += 2) {
    for (let x = 0; x < size.width; x += 2) {
      const i = (y * size.width + x) * 4
      const b = bitmap[i]
      const g = bitmap[i + 1]
      const r = bitmap[i + 2]
      const a = bitmap[i + 3]
      if (a < 128) continue
      samples.push([r, g, b])
    }
  }

  if (samples.length === 0) return { ...DEFAULT_LIGHT_COLORS }

  const avg: [number, number, number] = [0, 0, 0]
  let vivid: [number, number, number] = samples[0]
  let vividScore = -1
  let dark: [number, number, number] = samples[0]
  let light: [number, number, number] = samples[0]
  let darkL = 2
  let lightL = -1

  for (const [r, g, b] of samples) {
    avg[0] += r
    avg[1] += g
    avg[2] += b
    const l = luminance(r, g, b)
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    const score = sat * (1 - Math.abs(l - 0.45))
    if (score > vividScore) {
      vividScore = score
      vivid = [r, g, b]
    }
    if (l < darkL) {
      darkL = l
      dark = [r, g, b]
    }
    if (l > lightL) {
      lightL = l
      light = [r, g, b]
    }
  }

  avg[0] /= samples.length
  avg[1] /= samples.length
  avg[2] /= samples.length

  const avgL = luminance(...avg)
  const preferDark = avgL < 0.45

  const bg = preferDark
    ? mix(dark, avg, 0.35)
    : mix(light, [255, 255, 255], 0.55)
  const sidebar = preferDark ? mix(bg, [255, 255, 255], 0.08) : mix(bg, dark, 0.08)
  const text = preferDark ? mix(light, [255, 255, 255], 0.35) : mix(dark, [0, 0, 0], 0.35)
  const muted = mix(text, bg, 0.45)
  const accent = vividScore > 8 ? vivid : mix(vivid, preferDark ? [120, 160, 255] : [70, 110, 250], 0.4)
  const border = mix(bg, text, preferDark ? 0.22 : 0.14)

  return {
    bgPrimary: rgbToHex(...bg),
    bgSidebar: rgbToHex(...sidebar),
    textPrimary: rgbToHex(...text),
    textSecondary: rgbToHex(...muted),
    accent: rgbToHex(...accent),
    border: rgbToHex(...border),
    priorityLow: rgbToHex(...accent),
    priorityMedium: '#ffaf38',
    priorityHigh: '#fe7777',
  }
}

export interface PickedThemeImage {
  path: string
  colors: ThemeColors
  previewDataUrl: string
}

export async function pickAndStoreThemeImage(
  browserWindow: Electron.BrowserWindow | null,
): Promise<PickedThemeImage | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose a theme image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  }
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) return null

  const source = result.filePaths[0]
  const ext = extname(source).toLowerCase() || '.png'
  const dest = join(themesDir(), `${randomUUID()}${ext}`)
  copyFileSync(source, dest)

  const colors = extractPaletteFromImage(dest)
  const preview = nativeImage.createFromPath(dest)
  let previewDataUrl = ''
  if (!preview.isEmpty()) {
    // Prefer PNG→base64 so we never accidentally hand a native handle across IPC
    const png = preview.resize({ width: 320 }).toPNG()
    previewDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`
  }

  return {
    path: dest,
    colors: { ...colors },
    previewDataUrl,
  }
}

export function loadThemeImagePreview(filePath: string): string | null {
  if (!filePath || !existsSync(filePath)) return null
  const image = nativeImage.createFromPath(filePath)
  if (image.isEmpty()) return null
  const png = image.resize({ width: 320 }).toPNG()
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`
}

export function deleteThemeImage(filePath: string | null | undefined): void {
  if (!filePath) return
  try {
    if (existsSync(filePath) && /[/\\]themes[/\\]/.test(filePath)) {
      unlinkSync(filePath)
    }
  } catch {
    // ignore cleanup errors
  }
}
