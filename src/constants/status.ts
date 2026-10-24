import type { Role, RequestStatus, AttachmentType, LaborStatus } from '@/types'

export const ROLE_LABELS: Record<Role, string> = {
  employee: 'Employee',
  finance: 'Finance',
  general_manager: 'General Manager',
  owner: 'Owner',
  admin: 'Administrator',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  quote_received: 'Quote Received',
  awaiting_finance: 'Awaiting Finance',
  awaiting_gm: 'Awaiting GM',
  awaiting_owner: 'Awaiting Owner',
  approved: 'Approved',
  rejected: 'Rejected',
  purchased: 'Purchased',
  completed: 'Completed',
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'var(--status-draft)',
  quote_received: 'var(--status-amber)',
  awaiting_finance: 'var(--status-amber)',
  awaiting_gm: 'var(--status-amber)',
  awaiting_owner: 'var(--status-amber)',
  approved: 'var(--status-blue)',
  rejected: 'var(--status-red)',
  purchased: 'var(--status-purple)',
  completed: 'var(--status-green)',
}

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  receipt: 'Receipt',
  delivery: 'Delivery Document',
  photo: 'Photo',
  other: 'Other',
}

export const LABOR_STATUS_LABELS: Record<LaborStatus, string> = {
  requested: 'Requested',
  reviewed: 'Reviewed',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
