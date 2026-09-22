import type { IpcResult } from '@shared/ipc-types'

export function ipcOk<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

export function ipcFail(code: string, message: string): IpcResult<never> {
  return { ok: false, error: { code, message } }
}

export function normalizeError(error: unknown): IpcResult<never> {
  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      return ipcFail('NOT_FOUND', error.message)
    }
    if (error.message.includes('Cannot')) {
      return ipcFail('VALIDATION_ERROR', error.message)
    }
    return ipcFail('INTERNAL_ERROR', error.message)
  }
  return ipcFail('INTERNAL_ERROR', 'Unknown error')
}

export function runIpcHandler<T>(handler: () => T): IpcResult<T> {
  try {
    return ipcOk(handler())
  } catch (error) {
    return normalizeError(error)
  }
}

export async function runIpcHandlerAsync<T>(
  handler: () => Promise<T>,
): Promise<IpcResult<T>> {
  try {
    return ipcOk(await handler())
  } catch (error) {
    return normalizeError(error)
  }
}
