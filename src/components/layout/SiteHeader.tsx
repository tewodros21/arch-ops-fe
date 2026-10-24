import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const LINKS = [
  { href: '/#workflow', label: 'Workflow' },
  { href: '/#roles', label: 'Roles' },
  { href: '/#why', label: 'Why Arch Ops' },
]

export function SiteHeader({ variant = 'home' }: { variant?: 'home' | 'auth' }) {
  const { profile } = useAuth()

  return (
    <header className="flex h-[4.5rem] items-center justify-between gap-4">
      <Link to="/" className="focus-ring rounded-lg">
        <img src="/brand/logo-dark.png" alt="Arch Ops" className="h-7 w-auto" draggable={false} />
      </Link>

      <nav className="hidden items-center gap-8 md:flex">
        {LINKS.map((l) => (
          <Link key={l.href} to={l.href} className="text-sm font-medium tracking-wide text-[var(--ink)] uppercase hover:text-[var(--accent)]">
            {l.label}
          </Link>
        ))}
      </nav>

      {variant === 'auth' ? (
        <Link
          to="/"
          className="focus-ring inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium text-[var(--ink)] hover:bg-white"
        >
          <ArrowLeft size={16} />
          Home
        </Link>
      ) : (
        <Link
          to={profile ? '/dashboard' : '/login'}
          className="focus-ring inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold tracking-wide text-white uppercase transition-transform active:scale-[0.98]"
        >
          {profile ? 'Dashboard' : 'Sign in'}
          <ArrowRight size={16} />
        </Link>
      )}
    </header>
  )
}
