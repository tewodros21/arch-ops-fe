import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const inputClass =
  'focus-ring h-12 w-full rounded-2xl border border-black/10 bg-[var(--canvas)] px-4 pr-12 text-sm text-[var(--ink)] placeholder:text-slate-400 focus:border-[var(--ink)]'

/** Password field with a show / hide button, styled like the login form */
export function PasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  id,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  id?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        aria-label={id ? undefined : label}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        className="focus-ring absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:text-[var(--ink)]"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
