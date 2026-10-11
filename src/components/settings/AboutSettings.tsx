import { useEffect, useState } from 'react'
import { Coffee } from 'lucide-react'
import { ipc } from '@/lib/ipc-client'
import iconUrl from '../../../resources/icon.svg?url'

const DONATION_URL = 'https://dalink.to/artyomnosevich'

export function AboutSettings() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    void ipc.getVersion().then((result) => {
      if (result.ok) setVersion(result.data.version)
    })
  }, [])

  return (
    <section className="max-w-lg space-y-8">
      <div>
        <div className="flex items-start gap-4">
          <img
            src={iconUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-2xl"
          />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-text-primary">Open Tick</h3>
            <p className="mt-0.5 text-sm text-text-muted">
              Version {version ?? '…'}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-text-primary">
          Local-first desktop task manager with optional TickTick sync. Keep your lists, calendar,
          and reminders on your machine — connect TickTick when you want cloud sync.
        </p>
        <p className="mt-3 text-sm text-text-muted">
          Built with Electron and React for Windows, macOS, and Linux.
        </p>
      </div>

      <div>
        <h3 className="font-medium text-text-primary">Buy Me a Coffee</h3>
        <p className="mt-1 text-sm text-text-muted">
          If Open Tick saves you time or sparks ideas, you can support development here. Every donate
          helps keep the project moving — thank you!
        </p>
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#FFDD00] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Coffee className="size-4" aria-hidden />
          Buy Me a Coffee
        </a>
        <p className="mt-2 text-xs text-text-muted">
          <a
            href={DONATION_URL}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-border underline-offset-2 hover:text-text-primary"
          >
            {DONATION_URL.replace(/^https?:\/\//, '')}
          </a>
        </p>
      </div>
    </section>
  )
}
