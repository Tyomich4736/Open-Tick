import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { useEditorState } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Link as LinkIcon,
  Code2,
} from 'lucide-react'

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => {
        // Keep editor selection while clicking toolbar
        e.preventDefault()
      }}
      onClick={onClick}
      className={`rounded p-1.5 transition-colors disabled:opacity-40 ${
        active
          ? 'bg-accent/15 text-accent'
          : 'text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  )
}

function normalizeLinkUrl(raw: string): string {
  const url = raw.trim()
  if (!url) return ''
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return url
  return `https://${url}`
}

function applyLink(editor: Editor, rawUrl: string) {
  const href = normalizeLinkUrl(rawUrl)
  if (!href) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }

  const { empty } = editor.state.selection
  if (empty) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href } }],
      })
      .run()
    return
  }

  editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
}

function LinkPopover({
  editor,
  anchorRect,
  onClose,
}: {
  editor: Editor
  anchorRect: DOMRect
  onClose: () => void
}) {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
  const [url, setUrl] = useState(previous || 'https://')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const width = 320
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8))
  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 56)

  function submit() {
    applyLink(editor, url)
    onClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[1100] cursor-default bg-transparent"
        aria-label="Dismiss link editor"
        onMouseDown={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        role="dialog"
        aria-label="Edit link"
        className="fixed z-[1101] flex w-[320px] items-center gap-1 rounded-lg border border-border bg-bg-primary p-1.5 shadow-lg"
        style={{ top, left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="https://"
          className="min-w-0 flex-1 rounded-md border border-border bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <button
          type="button"
          className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90"
          onMouseDown={(e) => e.preventDefault()}
          onClick={submit}
        >
          Apply
        </button>
        {previous ? (
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-xs text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              onClose()
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
    </>,
    document.body,
  )
}

export function FormatToolbar({ editor, compact }: { editor: Editor; compact?: boolean }) {
  const icon = compact ? 'size-3.5' : 'size-4'
  const linkBtnRef = useRef<HTMLButtonElement>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkAnchor, setLinkAnchor] = useState<DOMRect | null>(null)

  useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive('bold'),
      italic: ctx.editor.isActive('italic'),
      underline: ctx.editor.isActive('underline'),
      strike: ctx.editor.isActive('strike'),
      code: ctx.editor.isActive('code'),
      h1: ctx.editor.isActive('heading', { level: 1 }),
      h2: ctx.editor.isActive('heading', { level: 2 }),
      h3: ctx.editor.isActive('heading', { level: 3 }),
      bullet: ctx.editor.isActive('bulletList'),
      ordered: ctx.editor.isActive('orderedList'),
      task: ctx.editor.isActive('taskList'),
      quote: ctx.editor.isActive('blockquote'),
      codeBlock: ctx.editor.isActive('codeBlock'),
      link: ctx.editor.isActive('link'),
    }),
  })

  function openLinkPopover() {
    const rect = linkBtnRef.current?.getBoundingClientRect()
    if (!rect) return
    setLinkAnchor(rect)
    setLinkOpen(true)
  }

  return (
    <div className={`flex flex-wrap items-center gap-0.5 ${compact ? '' : 'px-1.5 py-1'}`}>
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className={icon} />
      </ToolbarButton>

      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Heading 1"
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className={icon} />
      </ToolbarButton>

      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Checklist"
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className={icon} />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Code2 className={icon} />
      </ToolbarButton>
      <button
        ref={linkBtnRef}
        type="button"
        title="Link"
        aria-label="Link"
        aria-pressed={editor.isActive('link')}
        aria-expanded={linkOpen}
        onMouseDown={(e) => e.preventDefault()}
        onClick={openLinkPopover}
        className={`rounded p-1.5 transition-colors ${
          editor.isActive('link')
            ? 'bg-accent/15 text-accent'
            : 'text-text-muted hover:bg-black/5 hover:text-text-primary dark:hover:bg-white/5'
        }`}
      >
        <LinkIcon className={icon} />
      </button>
      {linkOpen && linkAnchor ? (
        <LinkPopover
          editor={editor}
          anchorRect={linkAnchor}
          onClose={() => {
            setLinkOpen(false)
            setLinkAnchor(null)
          }}
        />
      ) : null}
    </div>
  )
}

export function SelectionToolbar({ editor }: { editor: Editor }) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const [delayedVisible, setDelayedVisible] = useState(false)
  const selection = useEditorState({
    editor,
    selector: (ctx) => ({
      empty: ctx.editor.state.selection.empty,
      from: ctx.editor.state.selection.from,
      to: ctx.editor.state.selection.to,
      isCodeBlock: ctx.editor.isActive('codeBlock'),
      editable: ctx.editor.isEditable,
    }),
  })

  const selectionReady =
    selection.editable && !selection.empty && !selection.isCodeBlock && !editor.isDestroyed

  useEffect(() => {
    if (!selectionReady) {
      setDelayedVisible(false)
      return
    }
    const timer = window.setTimeout(() => setDelayedVisible(true), 1000)
    return () => window.clearTimeout(timer)
  }, [selectionReady, selection.from, selection.to])

  const visible = selectionReady && delayedVisible

  useLayoutEffect(() => {
    if (!visible) {
      setStyle(null)
      return
    }

    function place() {
      try {
        const { view } = editor
        const start = view.coordsAtPos(selection.from)
        const end = view.coordsAtPos(selection.to)
        const el = ref.current
        const tw = el?.offsetWidth || 280
        const th = el?.offsetHeight || 40
        const margin = 6
        const midX = (start.left + end.left) / 2
        const selTop = Math.min(start.top, end.top)
        const selBottom = Math.max(start.bottom, end.bottom)

        // Prefer above the selection; flip below if it would leave the window.
        let top = selTop - th - margin
        if (top < margin) {
          top = Math.min(selBottom + margin, window.innerHeight - th - margin)
        }
        top = Math.max(margin, Math.min(top, window.innerHeight - th - margin))

        let left = midX - tw / 2
        left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin))

        setStyle({
          position: 'fixed',
          top,
          left,
          zIndex: 1000,
          visibility: 'visible',
        })
      } catch {
        setStyle(null)
      }
    }

    // First paint hidden so we can measure, then clamp to the viewport.
    setStyle({
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 1000,
      visibility: 'hidden',
    })
    const raf = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [editor, visible, selection.from, selection.to])

  if (!visible) return null

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-auto rounded-lg border border-border bg-bg-primary p-0.5 shadow-md"
      style={style ?? { position: 'fixed', visibility: 'hidden' }}
    >
      <FormatToolbar editor={editor} compact />
    </div>,
    document.body,
  )
}
