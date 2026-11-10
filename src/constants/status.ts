import type { Role, RequestStatus, AttachmentType, LaborStatus } from '@/types'

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  ceo: 'CEO',
  project_manager: 'Project Manager',
  site_engineer: 'Site Engineer',
  finance: 'Finance',
  shopkeeper: 'Shopkeeper',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  quote_received: 'Quote Received',
  awaiting_finance: 'Awaiting Finance',
  awaiting_gm: 'Awaiting Project Manager',
  awaiting_owner: 'Awaiting CEO',
  approved: 'Approved',
  rejected: 'Rejected',
  purchased: 'In progress',
  completed: 'Delivered',
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
  proforma: 'Proforma',
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
