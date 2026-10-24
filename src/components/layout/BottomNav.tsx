import { Link, NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Menu, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { createActionFor, NAV } from './nav'

// Phones only: two destinations on each side and the page's create action raised in the middle.
// "More" opens the full sidebar drawer (vendors, audit, admin, account, sign out).
export function BottomNav({ onMore }: { onMore: () => void }) {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  if (!profile) return null

  const [home, purchases, labor] = NAV
  const create = createActionFor(pathname, profile.role)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-30 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="panel-dark grid h-16 grid-cols-5 items-center rounded-[1.5rem] px-1 shadow-[0_16px_40px_-16px_rgba(24,20,18,0.6)]">
        <Tab to={home.to} label={home.short} icon={home.icon} end />
        <Tab to={purchases.to} label={purchases.short} icon={purchases.icon} />

        <div className="flex justify-center">
          <Link
            to={{ search: create.search }}
            aria-label={create.aria}
            title={create.label}
            className="focus-ring -mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_10px_24px_-8px_var(--accent)] ring-4 ring-[var(--canvas)] transition-transform active:scale-95"
          >
            <create.icon size={22} strokeWidth={2.25} />
          </Link>
        </div>

        <Tab to={labor.to} label={labor.short} icon={labor.icon} />
        <button
          onClick={onMore}
          className="focus-ring flex h-full flex-col items-center justify-center gap-1 rounded-2xl text-[11px] text-white/55 transition-colors active:text-white"
        >
          <Menu size={20} strokeWidth={1.75} />
          More
        </button>
      </div>
    </nav>
  )
}

function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'focus-ring flex h-full flex-col items-center justify-center gap-1 rounded-2xl text-[11px] transition-colors',
          isActive ? 'font-semibold text-white' : 'text-white/55 active:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} className={isActive ? 'text-[var(--sun)]' : undefined} />
          {label}
        </>
      )}
    </NavLink>
  )
}
