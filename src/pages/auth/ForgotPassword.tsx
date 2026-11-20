import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck, Mail } from 'lucide-react'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { Button } from '@/components/ui'
import { requestPasswordReset } from '@/services/account'

const inputClass =
  'focus-ring h-12 w-full rounded-2xl border border-black/10 bg-[var(--canvas)] px-4 text-sm text-[var(--ink)] placeholder:text-slate-400 focus:border-[var(--ink)]'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error: apiError } = await requestPasswordReset(email.trim())
    setBusy(false)
    if (apiError) setError(apiError)
    else setSent(true)
  }

  return (
    <div className="app-shell relative z-10 flex min-h-screen flex-col px-4 sm:px-6">
      <SiteHeader variant="auth" />
      <main className="flex flex-1 items-center justify-center pb-4">
        <section className="w-full max-w-md rounded-[2rem] bg-white p-6 sm:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--sun)] text-[var(--ink)]">
            {sent ? <MailCheck size={22} /> : <Mail size={22} />}
          </span>
          {sent ? (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[var(--ink)]">Check your email</h1>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                If an account exists for <strong className="text-[var(--ink)]">{email.trim()}</strong>, we've sent a link to
                reset the password. It works for 1 hour. Check your spam folder if it doesn't arrive.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="focus-ring mt-6 text-sm font-semibold text-[var(--ink)] underline underline-offset-4"
              >
                Use a different email
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <h1 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[var(--ink)]">Forgot your password?</h1>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">Enter your work email and we'll send you a link to set a new one.</p>
              <label htmlFor="reset-email" className="mt-6 mb-1.5 block text-sm font-medium text-[var(--ink)]">Email</label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={inputClass}
              />
              {error && (
                <p role="alert" className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--ink)]">
                  {error}
                </p>
              )}
              <Button type="submit" loading={busy} className="mt-6 h-12 w-full">
                Send reset link
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
