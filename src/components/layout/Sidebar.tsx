import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { fetchTeam } from '@/services'
import { useAuth } from '@/context/AuthContext'
import { Avatar } from '@/components/ui'
import { notify } from '@/lib/notify'
import { USER_CREATED_EVENT } from '@/constants'
import { ROLE_LABELS, type Profile } from '@/types'
import { navFor } from './nav'

interface SidebarProps {
  /** Desktop only: icons-only rail */
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onClose }: SidebarProps) {
  const { profile } = useAuth()
  if (!profile) return null

  return (
    <>
      <aside
        className={clsx(
          'fixed top-4 bottom-4 left-4 z-30 hidden flex-col transition-[width] duration-300 ease-out md:flex',
          collapsed ? 'w-[4.75rem]' : 'w-64',
        )}
      >
        <SidebarPanel collapsed={collapsed} onToggle={onToggle} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="modal-fade-in absolute inset-0 bg-[#181412]/55 backdrop-blur-[4px]" onClick={onClose} />
          <aside className="drawer-in absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col p-3">
            <SidebarPanel collapsed={false} onClose={onClose} />
          </aside>
        </div>
      )}
    </>
  )
}

function SidebarPanel({ collapsed, onToggle, onClose }: { collapsed: boolean; onToggle?: () => void; onClose?: () => void }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [team, setTeam] = useState<Profile[]>([])
  const [teamExpanded, setTeamExpanded] = useState(false)

  useEffect(() => {
    let active = true

    async function loadTeam() {
      const { data, error } = await fetchTeam(teamExpanded ? undefined : 6)
      if (!active) return
      if (error) {
        notify.error(`Could not load team members: ${error.message}`)
        return
      }
      setTeam(data ?? [])
    }

    void loadTeam()
    window.addEventListener(USER_CREATED_EVENT, loadTeam)
    return () => {
      active = false
      window.removeEventListener(USER_CREATED_EVENT, loadTeam)
    }
  }, [teamExpanded])

  if (!profile) return null

  async function handleSignOut() {
    navigate('/', { replace: true })
    await signOut()
    notify.info('You have been signed out')
  }

  const toggle = onToggle && (
    <button
      onClick={onToggle}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="focus-ring rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
    >
      {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
    </button>
  )

  return (
    <div className="panel-dark flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[1.75rem]">
      {/* Fixed: logo + collapse toggle */}
      <div className={clsx('flex shrink-0 items-center gap-2.5 pt-6 pb-5', collapsed ? 'flex-col px-3' : 'px-6')}>
        <Link to="/dashboard" onClick={onClose} className={clsx('focus-ring rounded-lg', !collapsed && 'flex-1')}>
          {collapsed ? (
            <img src="/brand/logo-mark.png" alt="Arch Ops" className="h-9 w-9 rounded-xl" draggable={false} />
          ) : (
            <img src="/brand/logo-light.png" alt="Arch Ops" className="h-6 w-auto" draggable={false} />
          )}
        </Link>
        {toggle}
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="focus-ring rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Scrollable: nav + team */}
      <div className={clsx('scroll-dark min-h-0 flex-1 overflow-x-hidden overflow-y-auto', collapsed ? 'px-3' : 'px-4')}>
        <nav className="space-y-1">
          {navFor(profile.role).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  'focus-ring flex items-center gap-3 rounded-2xl py-2.5 text-sm transition-colors',
                  collapsed ? 'justify-center px-0' : 'px-3',
                  isActive ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <item.icon size={18} strokeWidth={1.6} className="shrink-0" />
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        {!collapsed && (
          <>
            <div className="my-4 border-t border-white/10" />
            <button
              type="button"
              onClick={() => setTeamExpanded((expanded) => !expanded)}
              aria-expanded={teamExpanded}
              aria-controls="sidebar-team-members"
              className="mb-3 flex w-full items-center justify-between rounded-xl px-2 py-1 text-left hover:bg-white/5"
            >
              <span className="text-sm font-medium text-white">Team members</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70">
                <ChevronRight size={14} className={clsx('transition-transform', teamExpanded && 'rotate-90')} />
              </span>
            </button>
            <ul id="sidebar-team-members" className="space-y-3 px-2 pb-4">
              {team.map((member, i) => (
                <li key={member.id} className="flex items-center gap-3">
                  <Avatar initials={member.avatar_initials} index={i} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{member.full_name}</p>
                    <p className="truncate text-xs text-white/45">{ROLE_LABELS[member.role]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Fixed: profile + sign out */}
      <div className="shrink-0 p-3">
        <div
          className={clsx(
            'flex items-center gap-1 rounded-2xl bg-white/[0.07] py-2',
            collapsed ? 'flex-col px-1' : 'pr-2.5 pl-1',
          )}
        >
          <Link
            to="/account"
            onClick={onClose}
            title="Your account"
            className={clsx(
              'focus-ring flex min-w-0 items-center gap-3 rounded-xl px-1.5 py-0.5 transition-colors hover:bg-white/[0.06]',
              !collapsed && 'flex-1',
            )}
          >
            <Avatar initials={profile.avatar_initials} size={34} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white">{profile.full_name}</p>
                <p className="truncate text-xs text-white/45">{ROLE_LABELS[profile.role]}</p>
              </div>
            )}
          </Link>
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="focus-ring rounded-full p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
