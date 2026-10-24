import { backend, type Result as ApiResult } from '@/api'
import type { ApprovalStage, RequestStatus, Role } from '@/types'

// Every status change runs server side (a workflow endpoint on the Django API) that checks the role,
// blocks self-approval, updates approvals, writes the audit event and sends notifications in one
// transaction. The UI only decides which buttons to show.

const STAGE_AWAITING: Record<ApprovalStage, RequestStatus> = {
  finance: 'awaiting_finance',
  gm: 'awaiting_gm',
  owner: 'awaiting_owner',
}

export const ROLE_STAGE: Record<Role, ApprovalStage | null> = {
  finance: 'finance',
  general_manager: 'gm',
  owner: 'owner',
  employee: null,
  admin: null,
}

export const STAGE_LABELS: Record<ApprovalStage, string> = { finance: 'Finance', gm: 'General Manager', owner: 'Owner' }

/** Statuses a requester can still edit and submit */
export const EDITABLE_STATUSES: RequestStatus[] = ['draft', 'quote_received']

type Result = { error: string | null }

async function call(run: Promise<ApiResult>): Promise<Result> {
  const { error } = await run
  return { error: error?.message ?? null }
}

/** Draft / Quote Received -> Awaiting Finance. Needs at least one quotation. */
export function submitRequest(requestId: string) {
  return call(backend.purchases.submit(requestId))
}

export function approveStage(requestId: string, comments?: string, approvedAmount?: number | null) {
  return call(backend.purchases.decide(requestId, 'approve', comments, approvedAmount))
}

export function rejectRequest(requestId: string, reason: string) {
  return call(backend.purchases.decide(requestId, 'reject', reason))
}

/** Sends the request back to the requester for changes; the approval chain restarts on resubmit */
export function returnToRequester(requestId: string, note: string) {
  return call(backend.purchases.decide(requestId, 'return', note))
}

export function recordPurchase(requestId: string, actualAmount: number) {
  return call(backend.purchases.recordPurchase(requestId, actualAmount))
}

export function completeRequest(requestId: string) {
  return call(backend.purchases.complete(requestId))
}

export function stageForStatus(status: RequestStatus): ApprovalStage | null {
  if (status === 'awaiting_finance') return 'finance'
  if (status === 'awaiting_gm') return 'gm'
  if (status === 'awaiting_owner') return 'owner'
  return null
}

export { STAGE_AWAITING }
