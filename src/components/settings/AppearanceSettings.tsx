import { useEffect, useState } from 'react'
import { Image as ImageIcon, RotateCcw, Upload } from 'lucide-react'
import {
  FONT_PRESETS,
  THEME_PRESETS,
  contrastRatio,
  defaultAppearance,
  type ThemeColors,
  type ThemeMode,
  type ThemeSource,
} from '@shared/appearance'
import { useAppearance } from '@/hooks/useAppearance'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'

type AppearanceTab = 'font' | 'theme'

const THEME_MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const SOURCE_OPTIONS: { value: ThemeSource; label: string }[] = [
  { value: 'preset', label: 'Preset' },
  { value: 'image', label: 'From image' },
  { value: 'custom', label: 'Custom colors' },
]

const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'bgPrimary', label: 'Background' },
  { key: 'bgSidebar', label: 'Sidebar' },
  { key: 'textPrimary', label: 'Primary text' },
  { key: 'textSecondary', label: 'Secondary text' },
  { key: 'accent', label: 'Accent' },
  { key: 'border', label: 'Border' },
]

export function AppearanceSettings() {
  const { appearance, updateAppearance } = useAppearance()
  const addToast = useToastStore((s) => s.addToast)
  const [tab, setTab] = useState<AppearanceTab>('theme')
  const [customFont, setCustomFont] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const matchedPreset = FONT_PRESETS.find((f) => f.value === appearance.fontFamily)
  const fontSelectValue = matchedPreset ? matchedPreset.id : 'custom'

  useEffect(() => {
    if (!matchedPreset) setCustomFont(appearance.fontFamily)
  }, [appearance.fontFamily, matchedPreset])

  useEffect(() => {
    let cancelled = false
    async function loadPreview() {
      if (!appearance.imageThemePath) {
        setPreviewUrl(null)
        return
      }
      const result = await ipc.theme.imagePreview(appearance.imageThemePath)
      if (!cancelled && result.ok) setPreviewUrl(result.data)
    }
    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [appearance.imageThemePath])

  const textContrast = contrastRatio(
    appearance.customColors.textPrimary,
    appearance.customColors.bgPrimary,
  )

  return (
    <section className="max-w-2xl">
      <p className="text-sm text-text-muted">Fonts and themes — changes apply instantly</p>

      <div className="mt-4 flex gap-1 border-b border-border">
        {(
          [
            { id: 'theme', label: 'Theme' },
            { id: 'font', label: 'Font' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              'px-3 py-2 text-sm transition-colors',
              tab === item.id
                ? 'border-b-2 border-accent font-medium text-accent'
                : 'text-text-muted hover:text-text-primary',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'font' && (
        <div className="mt-5 space-y-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Font family</label>
            <select
              value={fontSelectValue}
              onChange={(e) => {
                const id = e.target.value
                if (id === 'custom') {
                  void updateAppearance({ fontFamily: customFont || appearance.fontFamily })
                  return
                }
                const preset = FONT_PRESETS.find((f) => f.id === id)
                if (preset) void updateAppearance({ fontFamily: preset.value })
              }}
              className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {FONT_PRESETS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
              <option value="custom">Custom CSS…</option>
            </select>
          </div>

          {fontSelectValue === 'custom' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Custom font-family
              </label>
              <input
                value={customFont}
                onChange={(e) => setCustomFont(e.target.value)}
                onBlur={() => {
                  if (customFont.trim()) {
                    void updateAppearance({ fontFamily: customFont.trim() })
                  }
                }}
                placeholder="'Your Font', sans-serif"
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-text-muted">Font size</label>
              <span className="text-xs text-text-muted">{appearance.fontSize}px</span>
            </div>
            <input
              type="range"
              min={12}
              max={20}
              step={1}
              value={appearance.fontSize}
              onChange={(e) => void updateAppearance({ fontSize: Number(e.target.value) })}
              className="w-full accent-[var(--color-accent)]"
            />
          </div>

          <div
            className="rounded-lg border border-border bg-bg-sidebar px-4 py-3"
            style={{ fontFamily: appearance.fontFamily, fontSize: appearance.fontSize }}
          >
            <p className="font-medium text-text-primary">The quick brown fox</p>
            <p className="mt-1 text-text-muted">
              Preview — sidebar, task list, and detail panel use this type.
            </p>
          </div>
        </div>
      )}

      {tab === 'theme' && (
        <div className="mt-5 space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium text-text-muted">Theme mode</p>
            <div className="flex flex-wrap gap-2">
              {THEME_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void updateAppearance({ themeMode: opt.value })}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    appearance.themeMode === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-muted hover:border-accent/40',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-text-muted">Theme source</p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void updateAppearance({ themeSource: opt.value })}
                  className={[
                    'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    appearance.themeSource === opt.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-text-muted hover:border-accent/40',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {appearance.themeSource === 'preset' && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {THEME_PRESETS.map((preset) => {
                const swatch = preset.light
                const selected = appearance.presetId === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      void updateAppearance({ presetId: preset.id, themeSource: 'preset' })
                    }
                    className={[
                      'rounded-xl border p-2 text-left transition-colors',
                      selected ? 'border-accent ring-2 ring-accent/30' : 'border-border',
                    ].join(' ')}
                  >
                    <div
                      className="mb-2 flex h-14 overflow-hidden rounded-lg border"
                      style={{ borderColor: swatch.border }}
                    >
                      <div className="w-1/3" style={{ backgroundColor: swatch.bgSidebar }} />
                      <div className="flex flex-1 flex-col gap-1 p-1.5" style={{ backgroundColor: swatch.bgPrimary }}>
                        <div className="h-1.5 w-3/4 rounded" style={{ backgroundColor: swatch.textPrimary, opacity: 0.35 }} />
                        <div className="h-1.5 w-1/2 rounded" style={{ backgroundColor: swatch.accent }} />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-text-primary">{preset.name}</p>
                    <p className="text-xs text-text-muted">{preset.description}</p>
                  </button>
                )
              })}
            </div>
          )}

          {appearance.themeSource === 'image' && (
            <div className="space-y-3">
              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  <img src={previewUrl} alt="Theme source" className="max-h-40 w-full object-cover" />
                  {appearance.extractedPalette && (
                    <div className="flex gap-1 border-t border-border p-2">
                      {Object.values(appearance.extractedPalette)
                        .slice(0, 6)
                        .map((c, i) => (
                          <span
                            key={`${c}-${i}`}
                            className="h-6 flex-1 rounded"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-text-muted">
                  <ImageIcon className="size-8 opacity-50" />
                  <p className="text-sm">No image selected</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    try {
                      const result = await ipc.theme.pickImage()
                      if (!result.ok) {
                        addToast(result.error.message, 'error')
                        return
                      }
                      if (!result.data) return
                      if (appearance.imageThemePath) {
                        await ipc.theme.clearImage(appearance.imageThemePath)
                      }
                      await updateAppearance({
                        themeSource: 'image',
                        imageThemePath: result.data.path,
                        extractedPalette: result.data.colors,
                      })
                      setPreviewUrl(result.data.previewDataUrl || null)
                      addToast('Theme extracted from image', 'success')
                    } catch (error) {
                      addToast(
                        error instanceof Error ? error.message : 'Failed to pick image',
                        'error',
                      )
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
                >
                  <Upload className="size-4" />
                  {appearance.imageThemePath ? 'Replace image' : 'Choose image'}
                </button>
                {appearance.imageThemePath && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!appearance.imageThemePath) return
                      setBusy(true)
                      try {
                        const result = await ipc.theme.reextract(appearance.imageThemePath)
                        if (!result.ok) {
                          addToast(result.error.message, 'error')
                          return
                        }
                        await updateAppearance({
                          extractedPalette: result.data.colors,
                        })
                        setPreviewUrl(result.data.previewDataUrl || previewUrl)
                        addToast('Palette re-generated', 'success')
                      } finally {
                        setBusy(false)
                      }
                    }}
                    className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    Re-generate
                  </button>
                )}
              </div>
            </div>
          )}

          {appearance.themeSource === 'custom' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {COLOR_FIELDS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 text-sm text-text-primary">
                    <input
                      type="color"
                      value={appearance.customColors[key]}
                      onChange={(e) =>
                        void updateAppearance({
                          customColors: {
                            ...appearance.customColors,
                            [key]: e.target.value,
                          },
                        })
                      }
                      className="size-9 cursor-pointer rounded border border-border bg-transparent p-0"
                    />
                    <span>
                      {label}
                      <span className="ml-2 font-mono text-xs text-text-muted">
                        {appearance.customColors[key]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {textContrast < 4.5 && (
                <p className="text-sm text-priority-medium">
                  Text/background contrast is {textContrast.toFixed(1)}:1 — below WCAG AA (4.5:1).
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              if (appearance.imageThemePath) {
                await ipc.theme.clearImage(appearance.imageThemePath)
              }
              await updateAppearance(defaultAppearance())
              setPreviewUrl(null)
              addToast('Appearance reset to defaults', 'success')
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
          >
            <RotateCcw className="size-4" />
            Reset to default
          </button>
        </div>
      )}
    </section>
  )
}
