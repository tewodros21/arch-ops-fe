import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Power, Search, UserCog, UserPlus, Users, X } from 'lucide-react'
import { Avatar, useConfirm } from '@/components/ui'
import { Field, FormModal } from '@/components/admin/FormModal'
import { NEW_USER_SEARCH, USER_CREATED_EVENT } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { notify } from '@/lib/notify'
import { fetchProjects, fetchTeam, updateProfile } from '@/services'
import { getInitials } from '@/utils'
import { ROLE_LABELS, type Profile, type Role } from '@/types'
import { EmptyCard, ListCard } from './shared'

const ROLES = Object.keys(ROLE_LABELS) as Role[]
const PROJECT_ROLES: Role[] = ['project_manager', 'site_engineer']

function needsProjects(role: Role) {
  return PROJECT_ROLES.includes(role)
}

export function UsersTab() {
  const { profile: me } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)

  useEffect(() => {
    function load() {
      fetchTeam().then((p) => {
        if (p.error) notify.error('Could not load the team list')
        setPeople(p.data ?? [])
        setLoading(false)
      })
    }
    load()
    // The Add user modal lives in the layout; reload when it creates someone
    window.addEventListener(USER_CREATED_EVENT, load)
    return () => window.removeEventListener(USER_CREATED_EVENT, load)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = people.filter(
    (p) =>
      (!role || p.role === role) &&
      (!q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
  )

  async function toggleActive(person: Profile) {
    const isActive = !person.is_active
    setUpdatingIds((ids) => [...ids, person.id])
    try {
      const { data, error } = await updateProfile(person.id, { is_active: isActive })
      if (error || !data) {
        notify.error(
          error?.code === 'forbidden'
            ? 'You do not have permission to change this account.'
            : `Could not ${isActive ? 'activate' : 'deactivate'} this account: ${error?.message ?? 'Unknown error'}`,
        )
        return
      }

      setPeople((list) => list.map((item) => (item.id === person.id ? { ...item, ...data, is_active: isActive } : item)))
      notify.success(`${person.full_name} was ${isActive ? 'activated' : 'deactivated'}`)
    } finally {
      setUpdatingIds((ids) => ids.filter((id) => id !== person.id))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4 rounded-[1.75rem] bg-[var(--sun-soft)] p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--sun)] text-[var(--ink)]">
          <UserPlus size={19} />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold text-[var(--ink)]">Adding someone new?</p>
          <p className="mt-0.5 text-[var(--ink-soft)]">
            Create their account here with a temporary password and share it with them. They must change it before using the app.
          </p>
        </div>
        <Link
          to={{ search: NEW_USER_SEARCH }}
          className="focus-ring hidden h-11 shrink-0 items-center gap-2 self-center rounded-full bg-[var(--ink)] px-5 text-sm font-semibold text-white sm:inline-flex"
        >
          <Plus size={16} />
          Add user
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="field flex h-11 items-center gap-2 !py-0 lg:w-72">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0 lg:pb-0">
          <button className="chip focus-ring" aria-pressed={role === null} onClick={() => setRole(null)}>
            All <span className="text-xs opacity-60">{people.length}</span>
          </button>
          {ROLES.map((r) => (
            <button key={r} className="chip focus-ring whitespace-nowrap" aria-pressed={role === r} onClick={() => setRole(r)}>
              {ROLE_LABELS[r]} <span className="text-xs opacity-60">{people.filter((p) => p.role === r).length}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-slate-500">Loading people…</p>
      ) : filtered.length === 0 ? (
        <EmptyCard icon={Users} title="Nobody matches" />
      ) : (
        <ListCard columns={['Person', 'Role', 'Status', '']} template="md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto_auto]">
          {filtered.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--canvas)] md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto_auto] md:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar initials={p.avatar_initials} index={i} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{p.full_name}</p>
                  <p className="truncate text-xs text-slate-500">{p.email}</p>
                  <p className="mt-1 truncate text-xs text-[var(--ink-soft)] md:hidden">{ROLE_LABELS[p.role]}</p>
                </div>
              </div>
              <div className="hidden md:block">
                <RolePill role={p.role} />
              </div>
              <UserStatusPill active={p.is_active} />
              <div className="flex shrink-0 items-center gap-2">
                {me?.role === 'admin' && p.role !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    disabled={updatingIds.includes(p.id)}
                    aria-label={`${p.is_active ? 'Deactivate' : 'Activate'} ${p.full_name}`}
                    className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 px-3 text-xs font-semibold text-[var(--ink)] hover:bg-white disabled:cursor-wait disabled:opacity-50"
                  >
                    <Power size={14} />
                    {p.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  aria-label={`Edit ${p.full_name}`}
                  className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-[var(--ink)] hover:bg-white"
                >
                  <Pencil size={15} />
                </button>
              </div>
            </li>
          ))}
        </ListCard>
      )}

      {editing && (
        <EditPersonModal
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => setPeople((list) => list.map((i) => (i.id === p.id ? p : i)).sort((a, b) => a.full_name.localeCompare(b.full_name)))}
        />
      )}
    </div>
  )
}

function UserStatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        active ? 'bg-[#d3efdf] text-[#1e8c66]' : 'bg-[var(--canvas)] text-slate-500'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#1e8c66]' : 'bg-slate-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function RolePill({ role }: { role: Role }) {
  const tone =
    role === 'admin'
      ? 'bg-[var(--ink)] text-white'
      : role === 'ceo'
        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
        : role === 'site_engineer'
          ? 'bg-[var(--canvas)] text-[var(--ink-soft)]'
          : 'bg-[var(--sun-soft)] text-[var(--ink)]'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{ROLE_LABELS[role]}</span>
}

function EditPersonModal({ person, onClose, onSaved }: { person: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const { profile: me, refreshProfile } = useAuth()
  const confirm = useConfirm()
  const [name, setName] = useState(person.full_name)
  const [role, setRole] = useState<Role>(person.role)
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([])
  const [projectIds, setProjectIds] = useState<string[]>(person.project_ids ?? [])
  const [allProjects, setAllProjects] = useState(Boolean(person.has_all_projects))
  const [touched, setTouched] = useState(false)
  const isMe = me?.id === person.id
  const nameError = touched && !name.trim() ? 'Required' : null
  const showProjects = needsProjects(role)
  const projectsError = touched && showProjects && !allProjects && projectIds.length === 0 ? 'Assign at least one project, or choose all projects' : null

  useEffect(() => {
    fetchProjects().then(({ data, error }) => {
      if (error) {
        console.error('Error fetching projects:', error)
        notify.error('Could not load projects')
        return
      }
      setProjects((data ?? []).map((p) => ({ id: p.id, name: p.name, code: p.code })))
    })
  }, [])

  const availableProjects = projects.filter((p) => !projectIds.includes(p.id))
  const selectedProjects = projects.filter((p) => projectIds.includes(p.id))

  async function submit() {
    setTouched(true)
    if (!name.trim()) return false
    if (showProjects && !allProjects && projectIds.length === 0) return false
    if (isMe && role !== person.role) {
      const ok = await confirm({
        title: 'Change your own role?',
        body: `You will lose admin access as soon as this saves. Another admin would have to give it back.`,
        confirmLabel: 'Change my role',
        tone: 'danger',
      })
      if (!ok) return false
    }
    const patch = {
      full_name: name.trim(),
      avatar_initials: getInitials(name.trim()) || person.avatar_initials,
      role,
      has_all_projects: showProjects ? allProjects : false,
      project_ids: showProjects && !allProjects ? projectIds : showProjects ? [] : undefined,
    }
    const { data, error } = await updateProfile(person.id, patch)
    if (error || !data) {
      notify.error(`Could not save changes: ${error?.message ?? 'no permission'}`)
      return false
    }
    notify.success(`${name.trim().split(' ')[0]}'s profile was updated`)
    onSaved(data)
    if (isMe) await refreshProfile()
    return true
  }

  return (
    <FormModal
      title={`Edit ${person.full_name}`}
      description={<span className="break-all">{person.email}</span>}
      icon={UserCog}
      submitLabel="Save changes"
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Full name" htmlFor="p-name" error={nameError}>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className={nameError ? 'field !border-[var(--accent)]' : 'field'} />
      </Field>
      <Field label="Role" htmlFor="p-role">
        <select
          id="p-role"
          value={role}
          onChange={(e) => {
            const next = e.target.value as Role
            setRole(next)
            if (!needsProjects(next)) {
              setProjectIds([])
              setAllProjects(false)
            }
          }}
          className="field"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </Field>
      {showProjects && (
        <Field label="Assigned projects" htmlFor="p-projects" error={projectsError}>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
              <input
                type="checkbox"
                checked={allProjects}
                onChange={(e) => {
                  setAllProjects(e.target.checked)
                  if (e.target.checked) setProjectIds([])
                }}
                className="h-4 w-4 rounded border-black/20"
              />
              All projects
            </label>
            {!allProjects && (
              <>
                <select
                  id="p-projects"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (id && !projectIds.includes(id)) setProjectIds((current) => [...current, id])
                    e.target.value = ''
                  }}
                  className={projectsError ? 'field !border-[var(--accent)]' : 'field'}
                >
                  <option value="">Select a project to add</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
                {selectedProjects.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {selectedProjects.map((p) => (
                      <li key={p.id} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--canvas)] px-3 py-1.5 text-sm text-[var(--ink)]">
                        <span>{p.code} — {p.name}</span>
                        <button
                          type="button"
                          onClick={() => setProjectIds((current) => current.filter((id) => id !== p.id))}
                          aria-label={`Remove ${p.code}`}
                          className="focus-ring rounded-full p-0.5 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </Field>
      )}
    </FormModal>
  )
}
