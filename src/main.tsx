import { Component, StrictMode, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AppProviders } from './AppProviders'
import { ThemeProvider } from '@/components/ThemeProvider'
import { StickyNoteWindow } from '@/routes/StickyNoteWindow'
import { QuickCaptureWindow } from '@/routes/QuickCaptureWindow'
import { applyAppearance, defaultAppearance } from '@/lib/appearance'
import { queryClient } from '@/lib/queryClient'
import { ipc } from '@/lib/ipc-client'
import './styles/index.css'

function parseStickyTaskId(): string | null {
  const params = new URLSearchParams(window.location.search)
  if (params.get('window') === 'sticky') {
    const fromQuery = params.get('taskId')
    if (fromQuery) return decodeURIComponent(fromQuery)
  }
  const hash = window.location.hash.replace(/^#/, '')
  const match = hash.match(/^\/sticky\/([^/?]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function isStickyBoot(): boolean {
  return (
    new URLSearchParams(window.location.search).get('window') === 'sticky' ||
    /^#\/sticky\//.test(window.location.hash)
  )
}

function isQuickCaptureBoot(): boolean {
  return (
    new URLSearchParams(window.location.search).get('window') === 'quick-capture' ||
    window.location.hash.replace(/^#/, '') === '/quick-capture'
  )
}

class StickyErrorBoundary extends Component<
  { children: ReactNode; taskId: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Sticky note crashed', error, info)
  }

  render() {
    if (this.state.error) {
      const drag = { WebkitAppRegion: 'drag' } as CSSProperties
      const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties
      return (
        <div
          className="flex h-full flex-col p-3 text-sm text-neutral-900"
          style={{ backgroundColor: '#fff9c4', ...drag }}
        >
          <p className="font-semibold">Sticky failed to load</p>
          <p className="mt-1 text-neutral-700">{this.state.error.message}</p>
          <button
            type="button"
            className="mt-3 self-start rounded bg-black/10 px-2 py-1"
            style={noDrag}
            onClick={() => void ipc.stickies.close(this.props.taskId)}
          >
            Close
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function StickyBoot({ taskId }: { taskId: string }) {
  return (
    <StickyErrorBoundary taskId={taskId}>
      <StickyNoteWindow taskId={taskId} />
    </StickyErrorBoundary>
  )
}

const stickyTaskId = parseStickyTaskId()
const quickCapture = isQuickCaptureBoot()

if (isStickyBoot()) {
  document.documentElement.style.backgroundColor = '#fff9c4'
  document.body.style.backgroundColor = '#fff9c4'
  applyAppearance(defaultAppearance())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {stickyTaskId ? (
        <StickyBoot taskId={stickyTaskId} />
      ) : quickCapture ? (
        <ThemeProvider>
          <QuickCaptureWindow />
        </ThemeProvider>
      ) : (
        <ThemeProvider>
          <HashRouter>
            <AppProviders />
          </HashRouter>
        </ThemeProvider>
      )}
    </QueryClientProvider>
  </StrictMode>,
)
