/** Markdown collapses empty paragraphs; NBSP keeps blank lines visible in TipTap. */
export const BLANK_LINE_MARKER = '\u00a0'

/**
 * Turn blank-line gaps into explicit NBSP paragraphs so they survive markdown parse.
 * Idempotent for content that already uses {@link BLANK_LINE_MARKER}.
 *
 * Single `\n` soft breaks are left alone — TipTap markdown uses `breaks: true` so TickTick
 * plain-text newlines still render as line breaks.
 *
 * @example
 * preserveMarkdownBlankLines('a\\n\\nb') // 'a\\n\\n\\u00a0\\n\\nb'
 */
export function preserveMarkdownBlankLines(markdown: string): string {
  if (!markdown) return markdown

  const text = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const tokens = text.split(/(\n{2,})/)
  const out: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    if (/^\n{2,}$/.test(tok)) {
      const blankParagraphs = tok.length - 1
      const prev = out[out.length - 1]
      const next = tokens[i + 1]
      const prevIsMarker = prev === BLANK_LINE_MARKER
      const nextIsMarker = next === BLANK_LINE_MARKER || next?.trim() === BLANK_LINE_MARKER

      // Gaps around an existing marker are structural (`\n\n` before/after NBSP).
      const toAdd = prevIsMarker || nextIsMarker ? blankParagraphs - 1 : blankParagraphs
      for (let b = 0; b < toAdd; b++) out.push(BLANK_LINE_MARKER)
      continue
    }

    if (tok === BLANK_LINE_MARKER || tok.trim() === BLANK_LINE_MARKER) {
      out.push(BLANK_LINE_MARKER)
      continue
    }

    if (tok !== '') out.push(tok)
  }

  return out.join('\n\n')
}

/**
 * Strip NBSP blank-line markers before sending content to TickTick (plain newlines).
 */
export function restoreMarkdownBlankLines(markdown: string): string {
  if (!markdown) return markdown

  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) =>
      line === BLANK_LINE_MARKER || line.trim() === BLANK_LINE_MARKER ? '' : line,
    )
    .join('\n')
}
