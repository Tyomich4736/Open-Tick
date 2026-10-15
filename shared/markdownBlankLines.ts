/**
 * Placeholder on a blank hard-break line so markdown-it `breaks: true` does not
 * treat consecutive `\n\n` as a paragraph split (which collapses blank lines).
 * Zero-width — invisible, but the line stays a normal clickable text position.
 */
export const BLANK_LINE_MARKER = '\u200B'

/** Older builds used NBSP / marker paragraphs; still recognized on read/push. */
export const BLANK_LINE_MARKER_LEGACY = '\u00a0'

export function isBlankLineMarker(value: string): boolean {
  return (
    value === BLANK_LINE_MARKER ||
    value === BLANK_LINE_MARKER_LEGACY ||
    value.trim() === BLANK_LINE_MARKER ||
    value.trim() === BLANK_LINE_MARKER_LEGACY
  )
}

/** Undo CommonMark hard-break markers (`\` + newline / two spaces + newline). */
export function unwrapMarkdownHardBreaks(markdown: string): string {
  if (!markdown) return markdown
  return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\\\n/g, '\n').replace(/ {2}\n/g, '\n')
}

/**
 * Collapse legacy paragraph-style markers (`a\n\nMARKER\n\nb`) to plain blank gaps.
 */
function legacyMarkersToBlankGaps(text: string): string {
  if (!text.includes(BLANK_LINE_MARKER) && !text.includes(BLANK_LINE_MARKER_LEGACY)) {
    return text
  }
  // Only rewrite when markers sit as their own `\n\n`-separated blocks
  if (!/\n\n/.test(text)) return text

  const parts = text.split(/\n{2,}/)
  const hasBlockMarker = parts.some((part) => isBlankLineMarker(part))
  if (!hasBlockMarker) return text

  return parts.map((part) => (isBlankLineMarker(part) ? '' : part)).join('\n')
}

/**
 * Encode blank-line gaps as hard-break lines (TickTick-style).
 *
 * `a\n\nb`  → `a\n\u200B\nb`     (one clickable blank line)
 * `a\n\n\nb` → `a\n\u200B\n\u200B\nb` (two clickable blank lines)
 *
 * Soft breaks (`\n`) are left alone. Idempotent for content already encoded this way.
 */
export function preserveMarkdownBlankLines(markdown: string): string {
  if (!markdown) return markdown

  const text = legacyMarkersToBlankGaps(unwrapMarkdownHardBreaks(markdown))

  return text.replace(/\n{2,}/g, (gap) => {
    const blankLines = gap.length - 1
    return `\n${(BLANK_LINE_MARKER + '\n').repeat(blankLines)}`
  })
}

/**
 * Prepare description content for TickTick: strip blank-line placeholders.
 */
export function toTickTickContent(markdown: string): string {
  if (!markdown) return markdown

  let text = unwrapMarkdownHardBreaks(markdown)
  text = legacyMarkersToBlankGaps(text)

  if (!text.includes(BLANK_LINE_MARKER) && !text.includes(BLANK_LINE_MARKER_LEGACY)) {
    return text
  }

  // Hard-break style: marker-only lines → empty lines
  return text
    .split('\n')
    .map((line) => (isBlankLineMarker(line) ? '' : line))
    .join('\n')
}
