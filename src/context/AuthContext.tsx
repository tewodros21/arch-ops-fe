import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { backend, type ApiError } from '@/api'
import type { Profile } from '@/types'

interface AuthState {
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: ApiError | null }>
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
    return { error }
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
