import { backend, type DepartmentInput, type NewUserInput, type ProfilePatch, type ProjectInput } from '@/api'
import type { Profile } from '@/types'

// Admin screens get the full Result so they can tell "name taken" (conflict) and
// "still has requests" (in_use) apart from other failures.

export function fetchTeam(limit?: number) {
  return backend.profiles.list({ limit })
}

export function createUser(input: NewUserInput) {
  return backend.profiles.create(input)
}

export function updateProfile(id: string, patch: ProfilePatch) {
  return backend.profiles.update(id, patch)
}

export async function fetchTeamMembers(limit?: number): Promise<Profile[]> {
  const { data } = await fetchTeam(limit)
  return data ?? []
}

export function fetchAllDepartments(opts: { withMemberCount?: boolean } = {}) {
  return backend.departments.list(opts)
}

export function saveDepartment(input: DepartmentInput, id?: string) {
  return backend.departments.save(input, id)
}

export function deleteDepartment(id: string) {
  return backend.departments.remove(id)
}

export function fetchAllProjects(opts: { withSpend?: boolean } = {}) {
  return backend.projects.list(opts)
}

export function saveProject(input: ProjectInput, id?: string) {
  return backend.projects.save(input, id)
}

export function deleteProject(id: string) {
  return backend.projects.remove(id)
}
