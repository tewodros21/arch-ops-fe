import { backend } from '@/api'
import type { AttachmentType, PurchaseAttachment } from '@/types'

// Matches the API's upload rules (POST /purchase-requests/{id}/attachments/ in public/docs/openapi.yaml)
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'docx', 'xlsx']
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')
const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

/** Returns a short user-facing problem, or null when the file is fine to upload */
export function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext) || (file.type && !ALLOWED_MIME.includes(file.type))) {
    return 'Use a PDF, image, Word or Excel file'
  }
  if (file.size > MAX_FILE_BYTES) return 'Files must be 10 MB or smaller'
  return null
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Files are private: open them through a short-lived link from the server */
export async function openAttachment(attachment: Pick<PurchaseAttachment, 'id' | 'file_path' | 'file_url'>) {
  // Open the tab synchronously so popup blockers allow it, then point it at the signed link
  const tab = window.open('', '_blank')
  const { data: url, error } = await backend.attachments.url(attachment)
  if (!url) {
    tab?.close()
    return { error: error?.message ?? 'Could not open this file' }
  }
  if (tab) tab.location.href = url
  else window.location.href = url
  return { error: null }
}

/** Uploads the file and links it to the request as the signed-in user */
export async function attachFile(purchaseRequestId: string, file: File, attachmentType: AttachmentType, description?: string) {
  const problem = validateFile(file)
  if (problem) return { error: problem }
  const { error } = await backend.attachments.upload(purchaseRequestId, file, attachmentType, description)
  return { error: error?.message ?? null }
}
