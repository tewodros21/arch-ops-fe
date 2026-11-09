import { useEffect, useState } from 'react'
import { Copy, RefreshCw, UserPlus, X } from 'lucide-react'
import { notify } from '@/lib/notify'
import { createUser, fetchProjects } from '@/services'
import { ROLE_LABELS, type Profile, type Role } from '@/types'
import { Field, FormModal } from './FormModal'

const ROLES = Object.keys(ROLE_LABELS) as Role[]
const MIN_PASSWORD = 8
// No look-alike characters (0/O, 1/l/I) so the password survives being read out or retyped
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const PROJECT_ROLES: Role[] = ['project_manager', 'site_engineer']

function generatePassword(length = 12) {
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

function needsProjects(role: Role) {
  return PROJECT_ROLES.includes(role)
}

// There is no public sign-up: an admin creates the account here with a temporary password
// and shares it; the person changes it on their Account page.
export function UserFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (person: Profile) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('site_engineer')
  const [password, setPassword] = useState(generatePassword)
  const [projects, setProjects] = useState<{ id: string; name: string; code: string }[]>([])
  const [projectIds, setProjectIds] = useState<string[]>([])
  const [allProjects, setAllProjects] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    fetchProjects().then((rows) => setProjects(rows.map((p) => ({ id: p.id, name: p.name, code: p.code }))))
  }, [])

  const showProjects = needsProjects(role)
  const errors = {
    name: touched && !name.trim() ? 'Required' : null,
    email: touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a valid email' : null,
    password: touched && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : null,
    projects: touched && showProjects && !allProjects && projectIds.length === 0 ? 'Assign at least one project, or choose all projects' : null,
  }

  const availableProjects = projects.filter((p) => !projectIds.includes(p.id))
  const selectedProjects = projects.filter((p) => projectIds.includes(p.id))

  function addProject(projectId: string) {
    if (!projectId || projectIds.includes(projectId)) return
    setProjectIds((current) => [...current, projectId])
  }

  function removeProject(projectId: string) {
    setProjectIds((current) => current.filter((id) => id !== projectId))
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password)
      notify.success('Temporary password copied')
    } catch {
      notify.warning('Could not copy, select the password and copy it')
    }
  }

  async function submit() {
    setTouched(true)
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < MIN_PASSWORD) return false
    if (showProjects && !allProjects && projectIds.length === 0) return false
    const { data, error } = await createUser({
      email: email.trim().toLowerCase(),
      full_name: name.trim(),
      role,
      password,
      has_all_projects: showProjects ? allProjects : false,
      project_ids: showProjects && !allProjects ? projectIds : undefined,
    })
    if (error || !data) {
      notify.error(error?.code === 'conflict' ? 'Someone already uses that email' : `Could not add this person: ${error?.message ?? 'unknown error'}`)
      return false
    }
    notify.success(`${data.full_name.split(' ')[0]} can sign in now — they must change the temporary password on first login`)
    onSaved(data)
    return true
  }

  const fieldClass = (error: string | null) => (error ? 'field !border-[var(--accent)]' : 'field')

  return (
    <FormModal
      title="Add a person"
      description="They sign in with this email and temporary password, then change it on their Account page."
      icon={UserPlus}
      submitLabel="Create account"
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="Full name" htmlFor="u-name" error={errors.name}>
        <input id="u-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hana Bekele" autoComplete="off" className={fieldClass(errors.name)} />
      </Field>
      <Field label="Work email" htmlFor="u-email" error={errors.email}>
        <input
          id="u-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="hana@firm.com"
          autoComplete="off"
          className={fieldClass(errors.email)}
        />
      </Field>
      <Field label="Role" htmlFor="u-role">
        <select
          id="u-role"
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
        <Field
          label="Assigned projects"
          htmlFor="u-projects"
          error={errors.projects}
          hint={role === 'site_engineer' ? 'Site engineers often move between sites — use All projects when they cover every site' : 'Use the dropdown to add as many projects as you need'}
        >
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
                  id="u-projects"
                  value=""
                  onChange={(e) => {
                    addProject(e.target.value)
                    e.target.value = ''
                  }}
                  className={fieldClass(errors.projects)}
                >
                  <option value="">Select a project to add</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
                {selectedProjects.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {selectedProjects.map((p) => (
                      <li
                        key={p.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--canvas)] px-3 py-1.5 text-sm text-[var(--ink)]"
                      >
                        <span>{p.code} — {p.name}</span>
                        <button
                          type="button"
                          onClick={() => removeProject(p.id)}
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
      <Field label="Temporary password" htmlFor="u-password" error={errors.password}>
        <div className="flex gap-2">
          <input
            id="u-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            className={`${fieldClass(errors.password)} font-mono`}
          />
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            aria-label="Generate a new password"
            title="Generate a new password"
            className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 text-[var(--ink)] hover:bg-[var(--canvas)]"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={copyPassword}
            aria-label="Copy password"
            title="Copy password"
            className="focus-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/10 text-[var(--ink)] hover:bg-[var(--canvas)]"
          >
            <Copy size={16} />
          </button>
        </div>
      </Field>
      <p className="rounded-2xl bg-[var(--sun-soft)] px-4 py-3 text-xs leading-relaxed text-[var(--ink)]">
        Copy the password before you create the account and send it to them privately. It is not shown again.
      </p>
    </FormModal>
  )
}
