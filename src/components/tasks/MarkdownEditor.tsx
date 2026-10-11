import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { preserveMarkdownBlankLines } from '@shared/markdownBlankLines'
import {
  createMarkdownExtensions,
  getMarkdown,
  linkHrefFromClick,
  openEditorLink,
} from '@/components/tasks/markdown/extensions'
import { FormatToolbar, SelectionToolbar } from '@/components/tasks/markdown/MarkdownToolbar'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  /** Sticky paper: transparent shell, fills parent height */
  variant?: 'default' | 'sticky'
}

export function MarkdownEditor({ value, onChange, variant = 'default' }: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const valueRef = useRef(value)
  valueRef.current = value
  const lastEmitted = useRef<string | null>(null)
  const sticky = variant === 'sticky'

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createMarkdownExtensions(),
    content: preserveMarkdownBlankLines(value || ''),
    editorProps: {
      attributes: {
        class: sticky
          ? 'markdown-body markdown-body--sticky ProseMirror min-h-[6rem] flex-1 overflow-y-auto px-1 py-1 text-[13px] outline-none'
          : 'markdown-body ProseMirror min-h-[8rem] max-h-[40vh] overflow-y-auto px-3 py-2 text-sm text-text-primary outline-none',
      },
      handleClick: (view, pos, event) => {
        if (!(event.ctrlKey || event.metaKey)) return false
        const href = linkHrefFromClick(view, pos, event)
        if (!href) return false
        event.preventDefault()
        openEditorLink(href)
        return true
      },
      handleDOMEvents: {
        keydown: (view, event) => {
          if (event.key === 'Control' || event.key === 'Meta') {
            view.dom.classList.add('link-mod-held')
          }
          return false
        },
        keyup: (view, event) => {
          if (event.key === 'Control' || event.key === 'Meta') {
            view.dom.classList.remove('link-mod-held')
          }
          return false
        },
        blur: (view) => {
          view.dom.classList.remove('link-mod-held')
          return false
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = getMarkdown(ed)
      if (md === lastEmitted.current || md === valueRef.current) {
        lastEmitted.current = md
        return
      }
      lastEmitted.current = md
      onChangeRef.current(md)
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Avoid fighting the user while typing / focused
    if (editor.isFocused) return
    if (value === lastEmitted.current) return
    const current = getMarkdown(editor)
    if (value === current) {
      lastEmitted.current = value
      return
    }
    editor.commands.setContent(preserveMarkdownBlankLines(value || ''), { emitUpdate: false })
    lastEmitted.current = value
  }, [editor, value])

  if (!editor) {
    return (
      <div
        className={
          sticky
            ? 'min-h-[6rem] flex-1 px-1 py-1 text-[13px] text-[#8d6e63]/70'
            : 'min-h-[8rem] rounded-lg border border-border bg-bg-primary px-3 py-2 text-sm text-text-muted'
        }
      >
        Loading…
      </div>
    )
  }

  if (sticky) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
        <div className="shrink-0 border-t border-[#8d6e63]/15 bg-black/[0.03]">
          <FormatToolbar editor={editor} />
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-bg-primary focus-within:border-accent">
      <EditorContent editor={editor} />
      <SelectionToolbar editor={editor} />
      <div className="border-t border-border bg-bg-sidebar/60">
        <FormatToolbar editor={editor} />
      </div>
    </div>
  )
}
