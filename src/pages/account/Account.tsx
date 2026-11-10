import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Avatar, Button, PageHeader } from '@/components/ui'
import { Field } from '@/components/admin/FormModal'
import { useAuth } from '@/context/AuthContext'
import { notify } from '@/lib/notify'
import { PasswordChangeForm } from '@/components/account/PasswordChangeForm'
import { updateMyName } from '@/services'
import { getInitials } from '@/utils'
import { ROLE_LABELS } from '@/types'

export function Account({ forcePasswordChange = false }: { forcePasswordChange?: boolean }) {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [savingName, setSavingName] = useState(false)

  if (!profile) return null

  const nameChanged = name.trim() !== profile.full_name

  if (forcePasswordChange) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-5">
          <PageHeader title="Set your password" subtitle="Change your temporary password before continuing to Arch Ops." />
          <PasswordChangeForm required />
        </div>
      </main>
    )
  }

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
          <Meta label="Email">{profile.email}</Meta>
          <Meta label="Account status">{profile.is_active ? 'Active' : 'Inactive'}</Meta>
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
                <Field label="Role" htmlFor="acc-role" hint="Set by an admin">
                  <input
                    id="acc-role"
                    value={ROLE_LABELS[profile.role]}
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
          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Change password" />
            <PasswordChangeForm />
          </section>
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
