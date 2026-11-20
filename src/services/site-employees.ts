import { backend, type SiteEmployeeInput, type SiteEmployeePatch } from '@/api'

export function fetchSiteEmployees(opts: { department?: string; activeOnly?: boolean; search?: string } = {}) {
  return backend.siteEmployees.list(opts)
}

export function createSiteEmployee(input: SiteEmployeeInput) {
  return backend.siteEmployees.create(input)
}

export function updateSiteEmployee(id: string, patch: SiteEmployeePatch) {
  return backend.siteEmployees.update(id, patch)
}

export function deleteSiteEmployee(id: string) {
  return backend.siteEmployees.remove(id)
}
