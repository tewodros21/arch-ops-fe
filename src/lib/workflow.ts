import { backend, type Result as ApiResult } from '@/api'
import type { ApprovalStage, RequestStatus, Role } from '@/types'

// Every status change runs server side (a workflow endpoint on the Django API) that checks the role,
// blocks self-approval, updates approvals, writes the audit event and sends notifications in one
// transaction. The UI only decides which buttons to show.

const STAGE_AWAITING: Record<ApprovalStage, RequestStatus> = {
  project_manager: 'awaiting_pm',
  finance: 'awaiting_finance',
  gm: 'awaiting_finance',
  owner: 'awaiting_finance',
}

export const ROLE_STAGE: Record<Role, ApprovalStage | null> = {
  project_manager: 'project_manager',
  finance: 'finance',
  employee: null,
  ceo: null,
  site_engineer: null,
  shopkeeper: null,
  general_manager: null,
  owner: null,
  admin: null,
}

export const STAGE_LABELS: Record<ApprovalStage, string> = {
  project_manager: 'Project Manager',
  finance: 'Finance',
  gm: 'General Manager (legacy)',
  owner: 'Owner (legacy)',
}

/** Statuses a requester can still edit and submit */
export const EDITABLE_STATUSES: RequestStatus[] = ['draft', 'quote_received']

type Result = { error: string | null }

async function call(run: Promise<ApiResult>): Promise<Result> {
  const { error } = await run
  return { error: error?.message ?? null }
}

/** Draft / Quote Received -> assigned Project Manager, then Finance. */
export function submitRequest(requestId: string) {
  return call(backend.purchases.submit(requestId))
}

export function approveStage(requestId: string, comments?: string, approvedAmount?: number | null) {
  return call(backend.purchases.decide(requestId, 'approve', comments, approvedAmount))
}

export function rejectRequest(requestId: string, reason: string) {
  return call(backend.purchases.decide(requestId, 'reject', reason))
}

export function recordPurchase(requestId: string, actualAmount: number) {
  return call(backend.purchases.recordPurchase(requestId, actualAmount))
}

export function recordReceipt(requestId: string, items: { purchase_item_id: string; quantity_received: number }[], note?: string) {
  return call(backend.purchases.receive(requestId, { items, note }))
}

export function completeRequest(requestId: string) {
  return call(backend.purchases.complete(requestId))
}

export function stageForStatus(status: RequestStatus): ApprovalStage | null {
  if (status === 'awaiting_pm') return 'project_manager'
  if (status === 'awaiting_finance') return 'finance'
  return null
}

export { STAGE_AWAITING }
