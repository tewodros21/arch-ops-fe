import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react'
import { Avatar, Button, PageHeader } from '@/components/ui'
import { Field } from '@/components/admin/FormModal'
import { useAuth } from '@/context/AuthContext'
import { notify } from '@/lib/notify'
import { changePassword, updateMyName } from '@/services'
import { getInitials } from '@/utils'
import { ROLE_LABELS } from '@/types'

const MIN_PASSWORD = 8

export function Account() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwTouched, setPwTouched] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  if (!profile) return null

  const nameChanged = name.trim() !== profile.full_name
  const pwError = pwTouched && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : null
  const confirmError = pwTouched && !pwError && confirmPw !== password ? 'Passwords do not match' : null
  const currentError = pwTouched && !currentPw ? 'Enter your current password' : null

  async function saveName(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    const clean = name.trim()
    if (!clean) {
      notify.warning('Your name cannot be empty')
      return
    }
    setSavingName(true)
    const { error } = await updateMyName(clean, getInitials(clean) || profile.avatar_initials)
    if (!error) await refreshProfile()
    setSavingName(false)
    if (error) notify.error(`Could not save your name: ${error}`)
    else notify.success('Your name was updated')
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    setPwTouched(true)
    if (password.length < MIN_PASSWORD || password !== confirmPw || !currentPw) return
    setSavingPw(true)
    const { error } = await changePassword(password, currentPw)
    setSavingPw(false)
    if (error) {
      notify.error(`Could not change password: ${error}`)
      return
    }
    notify.success('Password changed, use it next time')
    setCurrentPw('')
    setPassword('')
    setConfirmPw('')
    setPwTouched(false)
  }

  async function handleSignOut() {
    navigate('/', { replace: true })
    await signOut()
    notify.info('You have been signed out')
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Account" subtitle="Your profile, password and session" />

      {/* ── Hero ── */}
      <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar initials={profile.avatar_initials} size={72} />
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white">{ROLE_LABELS[profile.role]}</span>
            <h2 className="mt-2 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.05] font-black tracking-[-0.03em] break-words text-[var(--ink)]">{profile.full_name}</h2>
            <p className="mt-1 truncate text-sm text-[var(--ink-soft)]">{profile.email}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-6 md:grid-cols-3">
          <Meta label="Role">{ROLE_LABELS[profile.role]}</Meta>
          <Meta label="Department">{profile.department || 'Not set'}</Meta>
          <Meta label="Email">{profile.email}</Meta>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          {/* ── Profile ── */}
          <form onSubmit={saveName} className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Profile" />
            <div className="space-y-4">
              <Field label="Full name" htmlFor="acc-name">
                <input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="name" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email" htmlFor="acc-email" hint="Read only">
                  <input id="acc-email" value={profile.email} readOnly className="field cursor-not-allowed !bg-[var(--canvas)] text-[var(--ink-soft)]" />
                </Field>
                <Field label="Role and department" htmlFor="acc-role" hint="Set by an admin">
                  <input
                    id="acc-role"
                    value={`${ROLE_LABELS[profile.role]}${profile.department ? ` · ${profile.department}` : ''}`}
                    readOnly
                    className="field cursor-not-allowed !bg-[var(--canvas)] text-[var(--ink-soft)]"
                  />
                </Field>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="submit" loading={savingName} disabled={!nameChanged}>
                Save name
              </Button>
            </div>
          </form>

          {/* ── Password ── */}
          <form onSubmit={savePassword} noValidate className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Change password" />
            <div className="mb-4">
              <Field label="Current password" htmlFor="acc-pw-current" error={currentError}>
                <input
                  id="acc-pw-current"
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  className={currentError ? 'field !border-[var(--accent)]' : 'field'}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="New password" htmlFor="acc-pw" error={pwError}>
                <div className="relative">
                  <input
                    id="acc-pw"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder={`${MIN_PASSWORD}+ characters`}
                    className={pwError ? 'field pr-11 !border-[var(--accent)]' : 'field pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:text-[var(--ink)]"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <Field label="Confirm password" htmlFor="acc-pw2" error={confirmError}>
                <input
                  id="acc-pw2"
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  className={confirmError ? 'field !border-[var(--accent)]' : 'field'}
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="submit" loading={savingPw} disabled={!password && !confirmPw}>
                <KeyRound size={16} />
                Update password
              </Button>
            </div>
          </form>
        </div>

        {/* ── Session ── */}
        <section className="panel-dark relative h-fit overflow-hidden rounded-[1.75rem] p-6">
          <div className="relative">
            <span className="rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">Session</span>
            <p className="mt-3 text-2xl leading-tight font-black text-white">Done for the day?</p>
            <p className="mt-1.5 text-sm text-white/60">Sign out on shared computers so nobody approves in your name.</p>
            <Button onClick={handleSignOut} className="mt-5 h-12 w-full border border-white/20 !bg-transparent hover:!bg-white/10">
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{children}</div>
    </div>
  )
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>
    </div>
  )
}
