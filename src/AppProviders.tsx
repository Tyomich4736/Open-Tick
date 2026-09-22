import { useIpcInvalidation } from '@/hooks/useIpcInvalidation'
import App from './App'

export function AppProviders() {
  useIpcInvalidation()
  return <App />
}
