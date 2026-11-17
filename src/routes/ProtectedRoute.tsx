import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SetPassword } from '@/pages/auth/SetPassword'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[var(--accent)]/20 border-t-[var(--accent)]" />
      </div>
    )
  }

  if (!profile) return <Navigate to="/login" replace />
  // The API refuses everything else until the temporary password is replaced
  if (profile.must_change_password) return <SetPassword />

  return <>{children}</>
}
