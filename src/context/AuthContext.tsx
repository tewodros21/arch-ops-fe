import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { backend } from '@/api'
import type { Profile } from '@/types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Re-reads the signed-in profile after it was edited (name, role, department) */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile() {
    setProfile(await backend.auth.me())
  }

  useEffect(() => {
    backend.auth
      .me()
      .then(setProfile)
      .finally(() => setLoading(false))

    return backend.auth.onChange((signedIn) => {
      if (signedIn) loadProfile()
      else setProfile(null)
    })
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await backend.auth.signIn(email, password)
    if (error) return { error: error.message }
    // Load profile and commit it before Login navigates, so ProtectedRoute
    // already sees the user (stale tokens used to skip the session listener).
    const me = await backend.auth.me()
    if (!me) {
      await backend.auth.signOut()
      return { error: 'Could not load your profile' }
    }
    flushSync(() => setProfile(me))
    return { error: null }
  }

  async function signOut() {
    await backend.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ profile, loading, signIn, signOut, refreshProfile: loadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
