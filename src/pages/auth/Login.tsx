import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { notify } from '@/lib/notify'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AssetSlot } from '@/components/ui'

const DEMO_PASSWORD = 'Demo!2026'

const ROLES = [
  { label: 'Employee', email: 'employee@demo.ethix.io', initials: 'EM' },
  { label: 'Finance', email: 'finance@demo.ethix.io', initials: 'FI' },
  { label: 'General Manager', email: 'gm@demo.ethix.io', initials: 'GM' },
  { label: 'Owner', email: 'owner@demo.ethix.io', initials: 'OW' },
  { label: 'Admin', email: 'admin@demo.ethix.io', initials: 'AD' },
]

const inputClass =
  'focus-ring h-12 w-full rounded-2xl border border-black/10 bg-[var(--canvas)] px-4 text-sm text-[var(--ink)] placeholder:text-slate-400 focus:border-[var(--ink)]'

export function Login() {
  const { signIn, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [quickRole, setQuickRole] = useState<string | null>(null)

  if (profile) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) notify.error(`Sign in failed: ${error}`)
    else notify.success('Welcome back, you are now signed in')
  }

  async function handleQuickLogin(roleEmail: string) {
    setQuickRole(roleEmail)
    const { error } = await signIn(roleEmail, DEMO_PASSWORD)
    setQuickRole(null)
    if (error) notify.error(`Demo sign in failed: ${error}`)
    else notify.success('Signed in to the demo workspace')
  }

  const busy = loading || quickRole !== null

  return (
    <div className="app-shell relative z-10 flex min-h-screen flex-col px-4 sm:px-6">
      <SiteHeader variant="auth" />

      <main className="grid flex-1 grid-cols-1 gap-3 pb-4 lg:grid-cols-2">
        <section className="flex items-center justify-center rounded-[2rem] bg-white px-6 py-12 sm:px-10">
          <div className="w-full max-w-sm">
            <h1 className="text-4xl font-black tracking-[-0.03em] text-[var(--ink)]">Sign in</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">Welcome back. Enter your work email to continue.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:text-[var(--ink)]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="focus-ring flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] text-sm font-semibold text-white transition-transform active:scale-[0.99] disabled:opacity-50"
              >
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Sign in
              </button>
            </form>

            <div className="my-8 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-black/10" />
              or explore with a demo role
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.email}
                  type="button"
                  onClick={() => handleQuickLogin(r.email)}
                  disabled={busy}
                  className="focus-ring inline-flex items-center gap-2 rounded-full border border-black/10 py-1.5 pr-4 pl-1.5 text-sm text-[var(--ink)] transition-colors hover:border-[var(--ink)] disabled:opacity-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--canvas)] text-[10px] font-bold">
                    {quickRole === r.email ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                    ) : (
                      r.initials
                    )}
                  </span>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel-dark relative hidden overflow-hidden rounded-[2rem] p-10 lg:flex lg:flex-col lg:justify-between">
          <p className="relative max-w-md text-[clamp(2.5rem,4.5vw,4.5rem)] leading-[0.92] font-black tracking-[-0.04em] text-white">
            Every spend<span className="text-[var(--accent)]">.</span> Signed off<span className="text-[var(--accent)]">.</span>
          </p>
          <div className="relative flex flex-1 items-center justify-center py-8">
            <AssetSlot src="/assets/3d/login.png" label="Login 3D asset" dark className="h-full max-h-[28rem] w-full" />
          </div>
          <p className="relative flex items-center gap-2 text-sm text-white/60">
            Requests <ArrowRight size={14} /> Finance <ArrowRight size={14} /> GM <ArrowRight size={14} /> Owner
          </p>
        </aside>
      </main>
    </div>
  )
}
