import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import { find as findLinks } from 'linkifyjs'
import { Markdown } from 'tiptap-markdown'
import type { MarkdownStorage } from 'tiptap-markdown'
import { TaskItemWithMarkdownInput } from '@/components/tasks/taskListMarkdownInput'
import { BLANK_LINE_MARKER } from '@shared/markdownBlankLines'

export const ParagraphPreserveBlankLines = Paragraph.extend({
  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (s: string) => void
            renderInline: (n: unknown) => void
            closeBlock: (n: unknown) => void
          },
          node: { content: { size: number }; textContent: string },
        ) {
          const isBlank =
            node.content.size === 0 ||
            node.textContent.length === 0 ||
            node.textContent === BLANK_LINE_MARKER
          if (isBlank) {
            state.write(BLANK_LINE_MARKER)
          } else {
            state.renderInline(node)
          }
          state.closeBlock(node)
        },
      },
    }
  },
})

export function getMarkdown(editor: Editor): string {
  return (editor.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown()
}

export function openEditorLink(href: string) {
  const url = href.trim()
  if (!url || url === '#') return
  // Main process setWindowOpenHandler → shell.openExternal
  window.open(url, '_blank', 'noopener,noreferrer')
}

function bareUrlAtPos(view: { state: Editor['state'] }, pos: number): string | null {
  const $pos = view.state.doc.resolve(pos)
  const parent = $pos.parent
  if (!parent.isTextblock) return null

  const text = parent.textBetween(0, parent.content.size, undefined, ' ')
  if (!text.trim()) return null

  const offsetInParent = $pos.parentOffset
  const matches = findLinks(text, { defaultProtocol: 'https' })
  const hit = matches.find(
    (item) => item.isLink && offsetInParent >= item.start && offsetInParent <= item.end,
  )
  return hit?.href ?? null
}

export function linkHrefFromClick(
  view: { state: Editor['state'] },
  pos: number,
  event: MouseEvent,
): string | null {
  const el = (event.target as HTMLElement | null)?.closest?.('a')
  const fromDom = el?.getAttribute('href')
  if (fromDom) return fromDom

  const linkType = view.state.schema.marks.link
  if (linkType) {
    const $pos = view.state.doc.resolve(pos)
    const mark =
      $pos.marks().find((m) => m.type === linkType) ??
      view.state.doc.nodeAt(pos)?.marks.find((m) => m.type === linkType)
    const href = mark?.attrs.href as string | undefined
    if (href) return href
  }

  // Plain-text URLs (not markdown `[text](url)` / link marks)
  return bareUrlAtPos(view, pos)
}

export function createMarkdownExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: false,
      paragraph: false,
    }),
    ParagraphPreserveBlankLines,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'text-accent underline',
        rel: 'noopener noreferrer',
      },
    }),
    TaskList,
    TaskItemWithMarkdownInput,
    Placeholder.configure({
      placeholder: 'Add a description…',
    }),
    Markdown.configure({
      html: false,
      // TickTick descriptions use plain `\n` soft breaks; without this they collapse in CommonMark.
      breaks: true,
      // Turn bare URLs in stored markdown into clickable <a> marks on load
      linkify: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ]
}
