import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingState } from '@/components/ui/states'
import { useAuth } from '@/stores/auth'

function useBootstrappedAuth() {
  const { user, status, bootstrap } = useAuth()
  useEffect(() => {
    void bootstrap()
  }, [bootstrap])
  return { user, ready: status === 'ready' }
}

/** UX-only guard: every API call is authorised again on the server. */
export function RequireAuth() {
  const { user, ready } = useBootstrappedAuth()
  const location = useLocation()
  if (!ready) return <LoadingState className="h-screen" label="Loading your workspace…" />
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}

export function GuestOnly() {
  const { user, ready } = useBootstrappedAuth()
  const location = useLocation()
  if (!ready) return <LoadingState className="h-screen" />
  if (user) {
    const next = new URLSearchParams(location.search).get('next')
    return <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'} replace />
  }
  return <Outlet />
}

export function AuthAware() {
  useBootstrappedAuth()
  return <Outlet />
}
