import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--accent)]/20 border-t-[var(--accent)]" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />

  // First-login gate: temporary password must be changed before using the app
  if (profile.must_change_password && location.pathname !== '/account') {
    return <Navigate to="/account" replace state={{ forcePasswordChange: true }} />
  }

  return <>{children}</>
}
