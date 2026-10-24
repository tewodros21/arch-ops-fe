import { useEffect, useState } from 'react'
import { Copy, RefreshCw, UserPlus } from 'lucide-react'
import { notify } from '@/lib/notify'
import { createUser, fetchDepartments } from '@/services'
import { ROLE_LABELS, type Department, type Profile, type Role } from '@/types'
import { Field, FormModal } from './FormModal'

const ROLES = Object.keys(ROLE_LABELS) as Role[]
const MIN_PASSWORD = 8
// No look-alike characters (0/O, 1/l/I) so the password survives being read out or retyped
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generatePassword(length = 12) {
  const bytes = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

// There is no public sign-up: an admin creates the account here with a temporary password
// and shares it; the person changes it on their Account page.
export function UserFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (person: Profile) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('employee')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState(generatePassword)
  const [departments, setDepartments] = useState<Department[]>([])
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    fetchDepartments().then(setDepartments)
  }, [])

  const errors = {
    name: touched && !name.trim() ? 'Required' : null,
    email: touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a valid email' : null,
    password: touched && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : null,
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
    const { data, error } = await createUser({
      email: email.trim().toLowerCase(),
      full_name: name.trim(),
      role,
      department: department || null,
      password,
    })
    if (error || !data) {
      notify.error(error?.code === 'conflict' ? 'Someone already uses that email' : `Could not add this person: ${error?.message ?? 'unknown error'}`)
      return false
    }
    notify.success(`${data.full_name.split(' ')[0]} can sign in now, share the temporary password`)
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Role" htmlFor="u-role">
          <select id="u-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="field">
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </Field>
        <Field label="Department" htmlFor="u-dept" hint="Optional">
          <select id="u-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="field">
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        </Field>
      </div>
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
