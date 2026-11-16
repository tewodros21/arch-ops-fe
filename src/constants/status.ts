import type { Role, RequestStatus, AttachmentType, LaborStatus, SupplierPaymentMethod } from '@/types'

export const ROLE_LABELS: Record<Role, string> = {
  ceo: 'CEO',
  project_manager: 'Project Manager',
  site_engineer: 'Site Engineer',
  shopkeeper: 'Store Keeper',
  finance: 'Finance',
  admin: 'Administrator',
}

export const STATUS_LABELS: Record<RequestStatus, string> = {
  draft: 'Draft',
  proforma_received: 'Proforma Received',
  awaiting_pm: 'Awaiting Project Manager',
  awaiting_finance: 'Awaiting Finance',
  approved: 'Approved',
  rejected: 'Rejected',
  purchased: 'Purchased',
  partially_received: 'Partially Received',
  completed: 'Completed',
}

export const STATUS_COLORS: Record<RequestStatus, string> = {
  draft: 'var(--status-draft)',
  proforma_received: 'var(--status-amber)',
  awaiting_pm: 'var(--status-amber)',
  awaiting_finance: 'var(--status-amber)',
  approved: 'var(--status-blue)',
  rejected: 'var(--status-red)',
  purchased: 'var(--status-purple)',
  partially_received: 'var(--status-purple)',
  completed: 'var(--status-green)',
}

export const ATTACHMENT_TYPE_LABELS: Record<AttachmentType, string> = {
  proforma: 'Proforma',
  invoice: 'Invoice',
  receipt: 'Receipt',
  delivery: 'Delivery Document',
  photo: 'Photo',
  other: 'Other',
}

export const PAYMENT_METHOD_LABELS: Record<SupplierPaymentMethod, string> = {
  bank: 'Bank account',
  telebirr: 'Telebirr',
}

export const LABOR_STATUS_LABELS: Record<LaborStatus, string> = {
  requested: 'Requested',
  reviewed: 'Reviewed',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
