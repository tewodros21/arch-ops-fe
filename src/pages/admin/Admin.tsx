import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Building2, FolderKanban, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'
import { UsersTab } from './UsersTab'
import { ProjectsTab } from './ProjectsTab'
import { DepartmentsTab } from './DepartmentsTab'

type Tab = 'users' | 'projects' | 'departments'

const TABS: { id: Tab; label: string; icon: typeof Users; roles: Role[]; subtitle: string }[] = [
  { id: 'users', label: 'Users', icon: Users, roles: ['admin'], subtitle: 'Roles and departments decide who approves what' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, roles: ['admin', 'owner'], subtitle: 'Sites requests are raised against, with spend against budget' },
  { id: 'departments', label: 'Departments', icon: Building2, roles: ['admin', 'owner'], subtitle: 'Teams people and requests belong to' },
]

export function Admin() {
  const { tab } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  if (!profile) return null

  const allowed = TABS.filter((t) => t.roles.includes(profile.role))
  if (allowed.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[1.75rem] bg-white px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--canvas)] text-slate-400">
          <ShieldCheck size={24} />
        </span>
        <p className="text-lg font-bold text-[var(--ink)]">Admins only</p>
        <p className="text-sm text-slate-500">Ask an administrator if you need access to settings.</p>
        <Link to="/dashboard" className="mt-1 text-sm font-medium text-[var(--accent)] underline underline-offset-4">
          Back to overview
        </Link>
      </div>
    )
  }

  const current = allowed.find((t) => t.id === tab)
  if (!current) return <Navigate to={`/admin/${allowed[0].id}`} replace />

  return (
    <div className="space-y-5">
      <PageHeader title="Admin" subtitle={current.subtitle} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {allowed.map((t) => (
          <button key={t.id} className="chip focus-ring" aria-pressed={t.id === current.id} onClick={() => navigate(`/admin/${t.id}`)}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {current.id === 'users' && <UsersTab />}
      {current.id === 'projects' && <ProjectsTab />}
      {current.id === 'departments' && <DepartmentsTab />}
    </div>
  )
}
