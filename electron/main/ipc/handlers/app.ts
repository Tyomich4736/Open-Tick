import { app } from 'electron'
import { IPC_CHANNELS } from '@shared/channels'
import type { IpcResult } from '@shared/ipc-types'

export function handlePing(): IpcResult<'pong'> {
  return { ok: true, data: 'pong' }
}

export function handleGetVersion(): IpcResult<{ version: string; platform: NodeJS.Platform }> {
  return {
    ok: true,
    data: {
      version: app.getVersion(),
      platform: process.platform,
    },
  }
}

export const APP_HANDLERS = {
  [IPC_CHANNELS.APP_PING]: handlePing,
  [IPC_CHANNELS.APP_GET_VERSION]: handleGetVersion,
} as const
