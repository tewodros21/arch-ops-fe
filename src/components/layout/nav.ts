import { Building2, FolderKanban, HardHat, History, LayoutGrid, Plus, Settings2, ShoppingCart, Store, UserPlus, Users, type LucideIcon } from 'lucide-react'
import { NEW_DEPARTMENT_SEARCH, NEW_LABOR_SEARCH, NEW_PROJECT_SEARCH, NEW_REQUEST_SEARCH, NEW_USER_SEARCH, NEW_VENDOR_SEARCH } from '@/constants'
import { canCreatePurchaseRequest } from '@/lib/workflow'
import type { Role } from '@/types'

export interface NavEntry {
  to: string
  label: string
  /** Short label for the mobile bottom bar */
  short: string
  icon: LucideIcon
  roles: Role[] | null
}

export const NAV: NavEntry[] = [
  { to: '/dashboard', label: 'Overview', short: 'Home', icon: LayoutGrid, roles: null },
  { to: '/requests', label: 'Purchase Requests', short: 'Purchases', icon: ShoppingCart, roles: null },
  { to: '/labor', label: 'Labor Requests', short: 'Labor', icon: Users, roles: null },
  { to: '/vendors', label: 'Vendors', short: 'Vendors', icon: Store, roles: ['finance'] },
  { to: '/admin/projects', label: 'Projects', short: 'Projects', icon: FolderKanban, roles: ['ceo'] },
  { to: '/audit', label: 'Audit Log', short: 'Audit', icon: History, roles: ['admin', 'ceo'] },
  { to: '/admin', label: 'Admin', short: 'Admin', icon: Settings2, roles: ['admin'] },
  { to: '/admin/projects', label: 'Projects', short: 'Projects', icon: FolderKanban, roles: ['ceo'] },
]

export function navFor(role: Role) {
  return NAV.filter((item) => !item.roles || item.roles.includes(role))
}

// The create button follows the page; restricted actions also respect the signed-in role.
export function createActionFor(pathname: string, role: Role) {
  if (pathname.startsWith('/labor')) {
    return { search: NEW_LABOR_SEARCH, label: 'Request labor', aria: 'New labor request', icon: HardHat }
  }
  if (pathname === '/admin/projects' && ['admin', 'ceo'].includes(role)) {
    return { search: NEW_PROJECT_SEARCH, label: 'Add project', aria: 'Add project', icon: FolderKanban }
  }
  if (pathname === '/admin/users' && role === 'admin') {
    return { search: NEW_USER_SEARCH, label: 'Add user', aria: 'Add user', icon: UserPlus }
  }
  if (pathname === '/admin/departments' && role === 'admin') {
    return { search: NEW_DEPARTMENT_SEARCH, label: 'Add department', aria: 'Add department', icon: Building2 }
  }
  if (pathname.startsWith('/vendors') && (role === 'admin' || role === 'finance')) {
    return { search: NEW_VENDOR_SEARCH, label: 'Add vendor', aria: 'Add vendor', icon: Store }
  }
  if (canCreatePurchaseRequest(role)) {
    return { search: NEW_REQUEST_SEARCH, label: 'New request', aria: 'New purchase request', icon: Plus }
  }
  return null
}
