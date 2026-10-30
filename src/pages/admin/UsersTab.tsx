import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Power, Search, UserCog, UserPlus, Users } from 'lucide-react'
import { Avatar, useConfirm } from '@/components/ui'
import { Field, FormModal } from '@/components/admin/FormModal'
import { NEW_USER_SEARCH, USER_CREATED_EVENT } from '@/constants'
import { useAuth } from '@/context/AuthContext'
import { notify } from '@/lib/notify'
import { fetchAllDepartments, fetchTeam, updateProfile } from '@/services'
import { getInitials } from '@/utils'
import { ROLE_LABELS, type Department, type Profile, type Role } from '@/types'
import { EmptyCard, ListCard } from './shared'

const ROLES = Object.keys(ROLE_LABELS) as Role[]

export function UsersTab() {
  const { profile: me } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<string[]>([])
  const [role, setRole] = useState<Role | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)

  useEffect(() => {
    function load() {
      Promise.all([fetchTeam(), fetchAllDepartments()]).then(([p, d]) => {
        if (p.error) notify.error('Could not load the team list')
        setPeople(p.data ?? [])
        setDepartments(d.data ?? [])
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
      (!q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.department ?? '').toLowerCase().includes(q)),
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
            Create their account here with a temporary password and share it with them. They change it on their Account page.
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, department" className="min-w-0 flex-1 bg-transparent outline-none" />
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
        <ListCard columns={['Person', 'Role', 'Department', 'Status', '']} template="md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          {filtered.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-[var(--canvas)] md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar initials={p.avatar_initials} index={i} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{p.full_name}</p>
                  <p className="truncate text-xs text-slate-500">{p.email}</p>
                  {/* Phones fold role and department under the name */}
                  <p className="mt-1 truncate text-xs text-[var(--ink-soft)] md:hidden">
                    {ROLE_LABELS[p.role]} · {p.department || 'No department'}
                  </p>
                </div>
              </div>
              <div className="hidden md:block">
                <RolePill role={p.role} />
              </div>
              <p className="hidden truncate text-sm text-[var(--ink-soft)] md:block">{p.department || '—'}</p>
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
          departments={departments}
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
      : role === 'owner'
        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
        : role === 'employee'
          ? 'bg-[var(--canvas)] text-[var(--ink-soft)]'
          : 'bg-[var(--sun-soft)] text-[var(--ink)]'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}>{ROLE_LABELS[role]}</span>
}

function EditPersonModal({ person, departments, onClose, onSaved }: { person: Profile; departments: Department[]; onClose: () => void; onSaved: (p: Profile) => void }) {
  const { profile: me, refreshProfile } = useAuth()
  const confirm = useConfirm()
  const [name, setName] = useState(person.full_name)
  const [role, setRole] = useState<Role>(person.role)
  const [department, setDepartment] = useState(person.department ?? '')
  const [touched, setTouched] = useState(false)
  const isMe = me?.id === person.id
  // Keep an inactive department selectable if the person is still in it
  const options = departments.filter((d) => d.is_active || d.name === person.department)
  const nameError = touched && !name.trim() ? 'Required' : null

  async function submit() {
    setTouched(true)
    if (!name.trim()) return false
    if (isMe && role !== person.role) {
      const ok = await confirm({
        title: 'Change your own role?',
        body: `You will lose admin access as soon as this saves. Another admin would have to give it back.`,
        confirmLabel: 'Change my role',
        tone: 'danger',
      })
      if (!ok) return false
    }
    const patch = { full_name: name.trim(), avatar_initials: getInitials(name.trim()) || person.avatar_initials, role, department: department || null }
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="p-role">
          <select id="p-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="field">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </Field>
        <Field label="Department" htmlFor="p-dept">
          <select id="p-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="field">
            <option value="">No department</option>
            {options.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-xs leading-relaxed text-[var(--ink-soft)]">
        Finance, the General Manager and the Owner each approve one stage. Employees see requests from their own department.
      </p>
    </FormModal>
  )
}
