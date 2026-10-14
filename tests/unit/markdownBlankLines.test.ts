import { describe, expect, it } from 'vitest'
import {
  BLANK_LINE_MARKER,
  preserveMarkdownBlankLines,
  restoreMarkdownBlankLines,
} from '../../shared/markdownBlankLines'

describe('preserveMarkdownBlankLines', () => {
  it('keeps single newlines (TickTick soft breaks)', () => {
    expect(preserveMarkdownBlankLines('line1\nline2')).toBe('line1\nline2')
  })

  it('normalizes CRLF and keeps soft breaks', () => {
    expect(preserveMarkdownBlankLines('line1\r\nline2')).toBe('line1\nline2')
  })

  it('inserts NBSP markers for blank paragraph gaps', () => {
    expect(preserveMarkdownBlankLines('a\n\nb')).toBe(`a\n\n${BLANK_LINE_MARKER}\n\nb`)
  })
})

describe('restoreMarkdownBlankLines', () => {
  it('turns NBSP markers back into empty lines for TickTick', () => {
    const local = `a\n\n${BLANK_LINE_MARKER}\n\nb`
    expect(restoreMarkdownBlankLines(local)).toBe('a\n\n\n\nb')
  })

  it('leaves soft breaks alone', () => {
    expect(restoreMarkdownBlankLines('line1\nline2')).toBe('line1\nline2')
  })
})
