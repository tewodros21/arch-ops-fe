import { useState } from 'react'
import { Outlet, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { PageTransition } from './PageTransition'
import { NewRequestModal } from '@/components/requests/NewRequestModal'
import { LaborRequestModal } from '@/components/labor/LaborRequestModal'
import { VendorFormModal } from '@/components/admin/VendorFormModal'
import { ProjectFormModal } from '@/components/admin/ProjectFormModal'
import { DepartmentFormModal } from '@/components/admin/DepartmentFormModal'
import { UserFormModal } from '@/components/admin/UserFormModal'
import { useAuth } from '@/context/AuthContext'
import { DEPARTMENT_CREATED_EVENT, PROJECT_CREATED_EVENT, USER_CREATED_EVENT, VENDOR_CREATED_EVENT } from '@/constants'
import { VENDOR_MANAGER_ROLES } from '@/services'

const COLLAPSED_KEY = 'archops.sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function DashboardLayout() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const creating = searchParams.get('new')
  // ?edit=<purchaseRequestId> reopens the create modal on a draft
  const editing = searchParams.get('edit')

  function closeCreate() {
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    next.delete('edit')
    setSearchParams(next)
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1')
      } catch {
        // Storage blocked: the choice lasts until reload
      }
      return !c
    })
  }

  return (
    <div className="app-shell relative z-10 min-h-screen w-full">
      <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <div className={clsx('relative flex min-h-screen flex-col transition-[padding] duration-300 ease-out', collapsed ? 'md:pl-[6.75rem]' : 'md:pl-[17.5rem]')}>
        {/* Bottom padding clears the phone bottom bar */}
        <div className="flex-1 px-4 pt-4 pb-28 sm:px-5 md:pb-8">
          <Topbar />
          <PageTransition>
            <Outlet />
          </PageTransition>
        </div>
      </div>
      <BottomNav onMore={() => setNavOpen(true)} />
      {creating === 'request' && !editing && <NewRequestModal onClose={closeCreate} />}
      {editing && <NewRequestModal key={editing} editId={editing} onClose={closeCreate} />}
      {creating === 'labor' && <LaborRequestModal onClose={closeCreate} />}
      {creating === 'vendor' && profile && VENDOR_MANAGER_ROLES.includes(profile.role) && (
        <VendorFormModal
          vendor={null}
          onClose={closeCreate}
          onSaved={() => window.dispatchEvent(new Event(VENDOR_CREATED_EVENT))}
        />
      )}
      {creating === 'project' && profile && (profile.role === 'admin' || profile.role === 'owner') && (
        <ProjectFormModal
          project={null}
          onClose={closeCreate}
          onSaved={() => window.dispatchEvent(new Event(PROJECT_CREATED_EVENT))}
        />
      )}
      {creating === 'user' && profile?.role === 'admin' && (
        <UserFormModal onClose={closeCreate} onSaved={() => window.dispatchEvent(new Event(USER_CREATED_EVENT))} />
      )}
      {creating === 'department' && profile && (profile.role === 'admin' || profile.role === 'owner') && (
        <DepartmentFormModal
          department={null}
          onClose={closeCreate}
          onSaved={() => window.dispatchEvent(new Event(DEPARTMENT_CREATED_EVENT))}
        />
      )}
    </div>
  )
}
