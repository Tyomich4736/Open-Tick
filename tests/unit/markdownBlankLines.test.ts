import { describe, expect, it } from 'vitest'
import {
  BLANK_LINE_MARKER,
  BLANK_LINE_MARKER_LEGACY,
  preserveMarkdownBlankLines,
  toTickTickContent,
  unwrapMarkdownHardBreaks,
} from '../../shared/markdownBlankLines'

describe('preserveMarkdownBlankLines', () => {
  it('keeps single newlines (TickTick soft breaks)', () => {
    expect(preserveMarkdownBlankLines('line1\nline2')).toBe('line1\nline2')
  })

  it('unwraps escaped hard breaks from a prior bad round-trip', () => {
    expect(preserveMarkdownBlankLines('link\\\nРелиз')).toBe('link\nРелиз')
  })

  it('encodes blank lines as clickable hard-break placeholder lines', () => {
    expect(preserveMarkdownBlankLines('a\n\nb')).toBe(`a\n${BLANK_LINE_MARKER}\nb`)
    expect(preserveMarkdownBlankLines('a\n\n\nb')).toBe(
      `a\n${BLANK_LINE_MARKER}\n${BLANK_LINE_MARKER}\nb`,
    )
    expect(preserveMarkdownBlankLines('a\n\n\n\nb')).toBe(
      `a\n${BLANK_LINE_MARKER}\n${BLANK_LINE_MARKER}\n${BLANK_LINE_MARKER}\nb`,
    )
  })

  it('is idempotent when already encoded as hard-break blanks', () => {
    const once = preserveMarkdownBlankLines('a\n\n\nb')
    expect(preserveMarkdownBlankLines(once)).toBe(once)
  })

  it('rewrites legacy paragraph-style NBSP markers into hard-break blanks', () => {
    expect(preserveMarkdownBlankLines(`a\n\n${BLANK_LINE_MARKER_LEGACY}\n\nb`)).toBe(
      `a\n${BLANK_LINE_MARKER}\nb`,
    )
  })
})

describe('toTickTickContent', () => {
  it('restores hard-break blank placeholders to empty lines', () => {
    expect(toTickTickContent(`a\n${BLANK_LINE_MARKER}\nb`)).toBe('a\n\nb')
    expect(toTickTickContent(`a\n${BLANK_LINE_MARKER}\n${BLANK_LINE_MARKER}\nb`)).toBe('a\n\n\nb')
  })

  it('restores legacy paragraph-style markers', () => {
    expect(toTickTickContent(`a\n\n${BLANK_LINE_MARKER_LEGACY}\n\nb`)).toBe('a\n\nb')
  })

  it('keeps a single soft newline', () => {
    expect(toTickTickContent('link\nРелиз')).toBe('link\nРелиз')
  })

  it('keeps blank lines that were stored without markers', () => {
    expect(toTickTickContent('a\n\nb')).toBe('a\n\nb')
    expect(toTickTickContent('a\n\n\nb')).toBe('a\n\n\nb')
  })

  it('strips hard-break backslashes', () => {
    expect(toTickTickContent('link\\\nРелиз')).toBe('link\nРелиз')
  })

  it('round-trips preserved blank lines without multiplying or dropping', () => {
    for (const fromTickTick of ['a\nb', 'a\n\nb', 'a\n\n\nb', 'a\n\n\n\nb']) {
      const stored = preserveMarkdownBlankLines(fromTickTick)
      expect(toTickTickContent(stored)).toBe(fromTickTick)
    }
  })
})

describe('unwrapMarkdownHardBreaks', () => {
  it('converts CommonMark hard breaks to plain newlines', () => {
    expect(unwrapMarkdownHardBreaks('a\\\nb')).toBe('a\nb')
    expect(unwrapMarkdownHardBreaks('a  \nb')).toBe('a\nb')
  })
})
