import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui'
import { Field } from '@/components/admin/FormModal'
import { useAuth } from '@/context/AuthContext'
import { notify } from '@/lib/notify'
import { changePassword } from '@/services'

const MIN_PASSWORD = 8

export function PasswordChangeForm({ required = false }: { required?: boolean }) {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  const passwordError = touched && password.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters` : null
  const confirmError = touched && !passwordError && confirmPassword !== password ? 'Passwords do not match' : null
  const currentError = touched && !currentPassword ? 'Enter your current password' : null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (password.length < MIN_PASSWORD || password !== confirmPassword || !currentPassword) return

    setSaving(true)
    const { error } = await changePassword(password, currentPassword)
    setSaving(false)
    if (error) {
      notify.error(`Could not change password: ${error}`)
      return
    }

    notify.success(required ? 'Password changed, you can now use the app' : 'Password changed, use it next time')
    setCurrentPassword('')
    setPassword('')
    setConfirmPassword('')
    setTouched(false)
    await refreshProfile()
    if (required) navigate('/dashboard', { replace: true })
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-[1.75rem] bg-white p-6 sm:p-8">
      <div className="mb-4">
        <Field label="Current password" htmlFor="acc-pw-current" error={currentError}>
          <input
            id="acc-pw-current"
            type={showPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            className={currentError ? 'field !border-[var(--accent)]' : 'field'}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="acc-pw" error={passwordError}>
          <div className="relative">
            <input
              id="acc-pw"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={`${MIN_PASSWORD}+ characters`}
              className={passwordError ? 'field pr-11 !border-[var(--accent)]' : 'field pr-11'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:text-[var(--ink)]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>
        <Field label="Confirm password" htmlFor="acc-pw2" error={confirmError}>
          <input
            id="acc-pw2"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            placeholder="Type it again"
            className={confirmError ? 'field !border-[var(--accent)]' : 'field'}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="submit" loading={saving} disabled={!password && !confirmPassword}>
          <KeyRound size={16} />
          Update password
        </Button>
      </div>
    </form>
  )
}
