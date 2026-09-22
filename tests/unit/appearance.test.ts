import { describe, expect, it } from 'vitest'
import {
  contrastRatio,
  darkenHex,
  defaultAppearance,
  getPreset,
  resolveThemeColors,
} from '../../shared/appearance'

describe('appearance helpers', () => {
  it('resolves preset colors by mode', () => {
    const appearance = { ...defaultAppearance(), presetId: 'midnight', themeSource: 'preset' as const }
    const light = resolveThemeColors(appearance, 'light')
    const dark = resolveThemeColors(appearance, 'dark')
    expect(light.bgPrimary).toBe(getPreset('midnight').light.bgPrimary)
    expect(dark.bgPrimary).toBe(getPreset('midnight').dark.bgPrimary)
  })

  it('prefers custom and image palettes', () => {
    const custom = { ...defaultAppearance().customColors, accent: '#112233' }
    const withCustom = {
      ...defaultAppearance(),
      themeSource: 'custom' as const,
      customColors: custom,
    }
    expect(resolveThemeColors(withCustom, 'dark').accent).toBe('#112233')

    const extracted = { ...defaultAppearance().customColors, accent: '#abcdef' }
    const withImage = {
      ...defaultAppearance(),
      themeSource: 'image' as const,
      extractedPalette: extracted,
    }
    expect(resolveThemeColors(withImage, 'light').accent).toBe('#abcdef')
  })

  it('computes contrast and darken', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeGreaterThan(20)
    expect(darkenHex('#4772fa', 0.1)).toMatch(/^#[0-9a-f]{6}$/)
  })
})
