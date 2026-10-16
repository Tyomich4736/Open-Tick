import { Navigate } from 'react-router-dom'
import { useSmartListSettings } from '@/hooks/useSmartListSettings'

/** Landing route: first enabled smart list (sidebar order). */
export function DefaultSmartListRedirect() {
  const { ready, defaultPath } = useSmartListSettings()
  if (!ready) return null
  return <Navigate to={defaultPath} replace />
}
