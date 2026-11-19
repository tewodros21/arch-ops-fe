import { useState, type FormEvent } from 'react'
import { KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { changePassword } from '@/services/account'
import { notify } from '@/lib/notify'
import { Button } from '@/components/ui'
import { PasswordInput } from '@/components/ui/PasswordInput'


/** Shown instead of the app when an admin-created account signs in with its temporary password */
export function SetPassword() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('Use at least 8 characters.')
    if (next !== confirm) return setError('The new passwords do not match.')
    if (next === current) return setError('Choose a password different from the temporary one.')
    setBusy(true)
    const { error: apiError } = await changePassword(next, current)
    if (apiError) {
      setBusy(false)
      setError(apiError)
      return
    }
    await refreshProfile()
    setBusy(false)
    notify.success('Password set. Welcome to ArchOps')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-[1.75rem] bg-white p-6 sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--sun)] text-[var(--ink)]">
          <KeyRound size={22} />
        </span>
        <h1 className="mt-4 text-2xl font-black text-[var(--ink)]">Set your own password</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          {profile?.full_name ? `Welcome, ${profile.full_name}. ` : ''}Your account was created with a temporary password.
          Choose a new one to continue.
        </p>

        <div className="mt-6 space-y-3">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Temporary password</span>
            <PasswordInput autoComplete="current-password" label="Temporary password" value={current} onChange={setCurrent} />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New password</span>
            <PasswordInput autoComplete="new-password" label="New password" value={next} onChange={setNext} />
            <span className="mt-1 block text-xs text-slate-500">At least 8 characters, not only numbers, not a common password.</span>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Confirm new password</span>
            <PasswordInput autoComplete="new-password" label="Confirm new password" value={confirm} onChange={setConfirm} />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} className="mt-6 h-12 w-full">
          Save password and continue
        </Button>
        <button
          type="button"
          onClick={() => signOut()}
          className="focus-ring mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </form>
    </main>
  )
}
