import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Copy, RefreshCw, Unplug, X } from 'lucide-react'
import type { PendingSyncTask } from '@shared/sync'
import { useSyncStatus } from '@/hooks/useSyncStatus'
import { useUiStore } from '@/stores/uiStore'
import { useTaskSelectionStore } from '@/stores/taskSelectionStore'
import { ipc } from '@/lib/ipc-client'
import { useToastStore } from '@/stores/toastStore'

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'Just now'
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function pendingLabel(status: PendingSyncTask['sync_status']): string {
  switch (status) {
    case 'pending_create':
      return 'New'
    case 'pending_update':
      return 'Edited'
    case 'pending_delete':
      return 'Deleted'
    default:
      return 'Pending'
  }
}

function PendingTasksSection({
  tasks,
  onOpenTask,
}: {
  tasks: PendingSyncTask[]
  onOpenTask: (task: PendingSyncTask) => void
}) {
  const [expanded, setExpanded] = useState(true)

  if (tasks.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-xs text-amber-700 dark:text-amber-300">Unpushed tasks</p>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} with local changes
          </p>
        </div>
        <ChevronDown
          className={[
            'size-4 shrink-0 text-amber-700 transition-transform dark:text-amber-300',
            expanded ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>
      {expanded && (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto border-t border-amber-200/80 px-1 py-1 dark:border-amber-900/40">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                disabled={task.deleted}
                title={task.deleted ? 'Deleted locally — push to remove remotely' : 'Open task'}
                onClick={() => onOpenTask(task)}
                className={[
                  'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                  task.deleted
                    ? 'cursor-default text-amber-800/70 dark:text-amber-200/60'
                    : 'text-amber-950 hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-900/40',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                    task.sync_status === 'pending_delete'
                      ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                      : task.sync_status === 'pending_create'
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-500/20 text-amber-900 dark:text-amber-200',
                  ].join(' ')}
                >
                  {pendingLabel(task.sync_status)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={[
                      'block truncate font-medium',
                      task.deleted ? 'line-through' : '',
                    ].join(' ')}
                  >
                    {task.title}
                  </span>
                  <span className="block truncate text-amber-800/70 dark:text-amber-200/60">
                    {task.project_is_inbox ? 'Inbox' : task.project_name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function IntegrationPanel() {
  const open = useUiStore((s) => s.integrationPanelOpen)
  const setOpen = useUiStore((s) => s.setIntegrationPanelOpen)
  const { status, progress, pullNow } = useSyncStatus()
  const addToast = useToastStore((s) => s.addToast)
  const navigate = useNavigate()
  const openTask = useTaskSelectionStore((s) => s.openTask)
  const [pendingTasks, setPendingTasks] = useState<PendingSyncTask[]>([])

  const refreshPendingTasks = useCallback(async () => {
    const result = await ipc.sync.listPendingTasks()
    if (result.ok) setPendingTasks(result.data)
  }, [])

  useEffect(() => {
    if (!open) return
    void refreshPendingTasks()
    const unsub = ipc.onChanged((notif) => {
      if (['task', 'project', 'folder', 'section'].includes(notif.entityType)) {
        void refreshPendingTasks()
      }
    })
    const unsubStatus = ipc.onSyncStatusChanged(() => {
      void refreshPendingTasks()
    })
    return () => {
      unsub()
      unsubStatus()
    }
  }, [open, refreshPendingTasks])

  if (!open) return null

  const connectionLabel = !status.configured
    ? 'Not configured'
    : !status.isConnected
      ? 'Not connected'
      : status.isOnline
        ? 'Connected'
        : 'Offline'

  async function onPull() {
    if (!status.isConnected || !status.isOnline || status.isSyncing) return
    const result = await pullNow()
    if (result.ok) {
      const s = result.data.stats
      addToast(
        result.data.partial
          ? `Pull finished with warnings · ${s.tasks} tasks`
          : `Pulled ${s.folders} folders, ${s.projects} lists, ${s.tasks} tasks`,
        result.data.partial ? 'info' : 'success',
      )
    } else {
      addToast(result.error.message, 'error')
    }
    void refreshPendingTasks()
  }

  async function onReconnect() {
    const result = await ipc.auth.connect()
    if (result.ok) addToast('Connected to TickTick', 'success')
    else if (!/cancelled|canceled/i.test(result.error.message)) {
      addToast(result.error.message, 'error')
    }
  }

  function copyError() {
    const text = [status.lastError, status.lastErrorAt].filter(Boolean).join('\n')
    if (!text) return
    void navigator.clipboard.writeText(text)
    addToast('Error details copied', 'success')
  }

  function openPendingTask(task: PendingSyncTask) {
    if (task.deleted) return
    openTask(task.id)
    if (task.project_is_inbox) navigate('/inbox')
    else navigate(`/project/${task.project_id}`)
    setOpen(false)
  }

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : status.isSyncing
        ? 15
        : 0

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/30" onMouseDown={() => setOpen(false)}>
      <aside
        className="flex h-full w-full max-w-[360px] flex-col border-l border-border bg-bg-primary shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Integration</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={[
                  'size-2 rounded-full',
                  status.isSyncing
                    ? 'animate-pulse bg-sky-500'
                    : status.lastSyncResult === 'failed' || status.lastError
                      ? 'bg-red-500'
                      : status.isConnected
                        ? 'bg-emerald-500'
                        : 'bg-neutral-400',
                ].join(' ')}
              />
              <span className="font-medium text-text-primary">{connectionLabel}</span>
            </div>
            {status.accountLabel && (
              <p className="mt-1 text-xs text-text-muted">{status.accountLabel}</p>
            )}
          </div>

          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Sync state</dt>
              <dd className="text-text-primary">
                {status.isSyncing ? 'Pulling' : status.lastError ? 'Error' : 'Idle'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Last pulled</dt>
              <dd className="text-right text-text-primary">
                <div>{formatRelative(status.lastSyncAt)}</div>
                <div className="text-text-muted">{formatAbsolute(status.lastSyncAt)}</div>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Last result</dt>
              <dd className="capitalize text-text-primary">
                {status.lastSyncResult ?? '—'}
              </dd>
            </div>
            {status.currentOperation && (
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Current</dt>
                <dd className="text-right text-text-primary">{status.currentOperation}</dd>
              </div>
            )}
            {status.lastPullStats && (
              <div className="rounded-lg border border-border bg-black/[0.02] px-3 py-2 dark:bg-white/[0.03]">
                <p className="text-text-muted">Last pull counts</p>
                <p className="mt-1 text-text-primary">
                  {status.lastPullStats.folders} folders · {status.lastPullStats.projects}{' '}
                  lists · {status.lastPullStats.tasks} tasks
                  {status.lastPullStats.skippedDirty > 0
                    ? ` · ${status.lastPullStats.skippedDirty} dirty skipped`
                    : ''}
                </p>
              </div>
            )}

            {(status.pendingPush?.total ?? 0) > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {status.pushEnabled
                    ? 'Pending push'
                    : 'Pending push — enable in Settings → Account'}
                </p>
                <p className="mt-0.5 text-sm">
                  {status.pendingPush.total} changes · {status.pendingPush.tasks} tasks ·{' '}
                  {status.pendingPush.projects} lists · {status.pendingPush.folders} folders
                  {(status.pendingPush.sections ?? 0) > 0
                    ? ` · ${status.pendingPush.sections} sections`
                    : ''}
                </p>
              </div>
            )}
          </dl>

          <PendingTasksSection tasks={pendingTasks} onOpenTask={openPendingTask} />

          {(status.isSyncing || progress) && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-text-muted">
                <span>Progress</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {status.lastError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-priority-high dark:border-red-900 dark:bg-red-950/40">
              <p>{status.lastError}</p>
              <button
                type="button"
                onClick={copyError}
                className="mt-2 inline-flex items-center gap-1 text-text-muted hover:text-text-primary"
              >
                <Copy className="size-3" />
                Copy error details
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={!status.isConnected || !status.isOnline || status.isSyncing}
              onClick={() => void onPull()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${status.isSyncing ? 'animate-spin' : ''}`} />
              Pull now
            </button>
            <button
              type="button"
              disabled={
                !status.isConnected ||
                !status.isOnline ||
                !status.pushEnabled ||
                (status.pendingPush?.total ?? 0) === 0 ||
                status.isSyncing
              }
              title={
                !status.pushEnabled
                  ? 'Enable push in Settings → Account first'
                  : (status.pendingPush?.total ?? 0) === 0
                    ? 'No local changes to push'
                    : undefined
              }
              onClick={async () => {
                const res = await ipc.sync.push()
                if (res.ok) {
                  const d = res.data
                  addToast(
                    d.errors.length
                      ? d.errors[0] ?? 'Push finished with errors'
                      : `Pushed ${d.processed} items`,
                    d.errors.length ? 'error' : 'success',
                  )
                } else {
                  addToast(res.error.message, 'error')
                }
                void refreshPendingTasks()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-black/5 disabled:opacity-50"
            >
              Push now
            </button>
            <button
              type="button"
              disabled={!status.isConnected || !status.isOnline || status.isSyncing}
              onClick={async () => {
                if (!confirm('Delete ALL local data and re-download everything from TickTick?')) return
                const res = await ipc.sync.fullResetAndPull()
                if (res.ok) {
                  const s = res.data.stats
                  addToast(
                    res.data.partial
                      ? `Reset done with warnings · ${s.tasks} tasks pulled`
                      : `Reset + pull finished · ${s.folders} folders, ${s.projects} lists, ${s.tasks} tasks`,
                    res.data.partial ? 'info' : 'success',
                  )
                } else {
                  addToast(res.error.message, 'error')
                }
                void refreshPendingTasks()
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Full local cleanup + pull from TickTick
            </button>
            {(!status.isConnected || status.lastSyncResult === 'failed') && status.configured && (
              <button
                type="button"
                onClick={() => void onReconnect()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Unplug className="size-3.5" />
                {status.isConnected ? 'Reconnect' : 'Connect TickTick'}
              </button>
            )}
          </div>

          <p className="text-xs text-text-muted">
            Pull brings data from TickTick into this app. Local edits with unsynced changes are not
            overwritten.
          </p>
        </div>
      </aside>
    </div>
  )
}
