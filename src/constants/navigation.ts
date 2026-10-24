import type { Role } from '@/types'

export interface NavItem {
  to: string
  label: string
  roles: Role[] | null
}

export const NAVIGATION_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', roles: null },
  { to: '/requests', label: 'Purchase Requests', roles: null },
  { to: '/labor', label: 'Labor Requests', roles: null },
  { to: '/vendors', label: 'Vendors', roles: ['admin', 'owner', 'finance'] },
  { to: '/audit', label: 'Audit Log', roles: ['admin', 'owner'] },
]

// Any dashboard link to these searches opens the matching create modal over the current page
export const NEW_REQUEST_SEARCH = '?new=request'
export const NEW_LABOR_SEARCH = '?new=labor'
export const NEW_VENDOR_SEARCH = '?new=vendor'
export const NEW_PROJECT_SEARCH = '?new=project'
export const NEW_DEPARTMENT_SEARCH = '?new=department'
export const NEW_USER_SEARCH = '?new=user'

// Fired after global create modals save so open lists can reload
export const LABOR_CREATED_EVENT = 'labor-request-created'
export const VENDOR_CREATED_EVENT = 'vendor-created'
export const PROJECT_CREATED_EVENT = 'project-created'
export const DEPARTMENT_CREATED_EVENT = 'department-created'
export const USER_CREATED_EVENT = 'user-created'
