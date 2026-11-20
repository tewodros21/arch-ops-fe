import { backend } from '@/api'

export async function updateMyName(fullName: string, avatarInitials: string) {
  const { error } = await backend.auth.updateMe({ full_name: fullName, avatar_initials: avatarInitials })
  return { error: error?.message ?? null }
}

/** The API checks the current password before changing it */
export async function changePassword(newPassword: string, currentPassword: string) {
  const { error } = await backend.auth.changePassword(newPassword, currentPassword)
  return { error: error?.message ?? null }
}

export async function requestPasswordReset(email: string) {
  const { error } = await backend.auth.requestPasswordReset(email)
  return { error: error?.message ?? null }
}

export async function confirmPasswordReset(uid: string, token: string, newPassword: string) {
  const { error } = await backend.auth.confirmPasswordReset(uid, token, newPassword)
  return { error: error?.message ?? null }
}
