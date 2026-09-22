import type { IpcResult } from '@shared/ipc-types'
import { useToastStore } from '@/stores/toastStore'

export function unwrapIpc<T>(result: IpcResult<T>): T {
  if (!result.ok) {
    throw new Error(result.error.message)
  }
  return result.data
}

export async function ipcCall<T>(
  fn: () => Promise<IpcResult<T>>,
  errorMessage = 'Something went wrong',
): Promise<T> {
  try {
    return unwrapIpc(await fn())
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage
    useToastStore.getState().addToast(message, 'error')
    throw error instanceof Error ? error : new Error(errorMessage)
  }
}
