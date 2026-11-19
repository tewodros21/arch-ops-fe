import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Button } from '@/components/ui'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { notify } from '@/lib/notify'
import { confirmPasswordReset } from '@/services/account'

/** Opened from the emailed link: /reset-password?uid=...&token=... */
export function ResetPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('Use at least 8 characters.')
    if (next !== confirm) return setError('The passwords do not match.')
    setBusy(true)
    const { error: apiError } = await confirmPasswordReset(uid, token, next)
    setBusy(false)
    if (apiError) return setError(apiError)
    notify.success('Password changed. Sign in with your new password')
    navigate('/login', { replace: true })
  }

  const linkMissing = !uid || !token

  return (
    <div className="app-shell relative z-10 flex min-h-screen flex-col px-4 sm:px-6">
      <SiteHeader variant="auth" />
      <main className="flex flex-1 items-center justify-center pb-4">
        <section className="w-full max-w-md rounded-[2rem] bg-white p-6 sm:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--sun)] text-[var(--ink)]">
            <KeyRound size={22} />
          </span>
          {linkMissing ? (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[var(--ink)]">Link incomplete</h1>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">Open the full link from the email, or request a new one.</p>
              <Link to="/forgot-password" className="focus-ring mt-6 inline-block text-sm font-semibold text-[var(--ink)] underline underline-offset-4">
                Request a new link
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[var(--ink)]">Choose a new password</h1>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">You'll be signed out on other devices.</p>
              <div className="mt-6 space-y-3">
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">New password</label>
                  <PasswordInput id="new-password" label="New password" autoComplete="new-password" value={next} onChange={setNext} />
                  <span className="mt-1 block text-xs text-slate-500">At least 8 characters, not only numbers, not a common password.</span>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Confirm new password</label>
                  <PasswordInput id="confirm-password" label="Confirm new password" autoComplete="new-password" value={confirm} onChange={setConfirm} />
                </div>
              </div>
              {error && (
                <p role="alert" className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">
                  {error}
                  {error.includes('expired') && (
                    <>
                      {' '}
                      <Link to="/forgot-password" className="font-semibold underline underline-offset-2">Request a new link</Link>
                    </>
                  )}
                </p>
              )}
              <Button type="submit" loading={busy} className="mt-6 h-12 w-full">
                Save new password
              </Button>
            </form>
          )}
          <Link to="/login" className="focus-ring mt-6 block text-center text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Back to sign in
          </Link>
        </section>
      </main>
    </div>
  )
}
