import type {
  AppNotification,
  AttachmentType,
  AuditEvent,
  Department,
  LaborRequest,
  PurchaseAttachment,
  Profile,
  Project,
  PurchaseRequest,
  RequestStatus,
  Role,
  Vendor,
  VendorQuotation,
} from '@/types'

// The contract the data source implements. The UI talks to `backend` (src/api/index.ts) through
// src/services, so screens never call the Django REST API (public/docs/openapi.yaml) directly.

/** Normalized so the UI can react to a cause without knowing HTTP codes */
export type ErrorCode = 'validation' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'in_use' | 'network' | 'unknown'

export interface ApiError {
  message: string
  code: ErrorCode
}

export type Result<T = null> = { data: T | null; error: ApiError | null }

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface RequestInput {
  title: string
  description: string
  project_id: string
  department: string
  estimated_amount: number
  justification: string
  required_date: string | null
}

export interface ItemInput {
  name: string
  quantity: number
  unit: string
  estimated_unit_price: number | null
  description: string | null
}

export interface QuotationInput {
  vendor_id: string
  amount: number
  valid_until: string | null
  notes: string | null
}

export type VendorInput = Pick<Vendor, 'name' | 'contact_person' | 'phone' | 'email' | 'services' | 'address'> & { is_active: boolean }
export type ProjectInput = Pick<Project, 'name' | 'code' | 'client_name' | 'location' | 'budget' | 'is_active'>
export type DepartmentInput = Pick<Department, 'name' | 'is_active'>

export interface ProfilePatch {
  full_name?: string
  avatar_initials?: string
  role?: Role
  department?: string | null
}

/** An admin adding a teammate; they sign in with the temporary password and change it on their Account page */
export interface NewUserInput {
  email: string
  full_name: string
  role: Role
  department: string | null
  password: string
}

export interface LaborInput {
  project_id: string
  labor_type: string
  workers_required: number
  location: string
  description: string
  required_at: string
  expected_duration_hours: number | null
}

export type LaborPatch = Partial<Pick<LaborRequest, 'status' | 'assigned_to' | 'management_notes'>>

export type Decision = 'approve' | 'reject' | 'return'

// ── Read models ──────────────────────────────────────────────────────────────

export type VendorRequestSummary = Pick<
  PurchaseRequest,
  'id' | 'request_number' | 'title' | 'status' | 'created_at' | 'estimated_amount' | 'approved_amount' | 'actual_amount'
> & { project?: { name: string } | null }

export interface VendorQuoteRow extends Omit<VendorQuotation, 'vendor'> {
  request: VendorRequestSummary | null
  /** Every quote amount on the same request, this one included */
  competing: number[]
}

export interface VendorHistory {
  quotes: VendorQuoteRow[]
  documents: (PurchaseAttachment & { request?: Pick<PurchaseRequest, 'id' | 'request_number' | 'title'> | null })[]
}

export interface PurchaseCountFilter {
  statuses?: RequestStatus[]
  requesterId?: string
}

export interface AuditQuery {
  limit?: number
  /** ISO timestamp, inclusive */
  since?: string
  entity_type?: string
  entity_id?: string
  ascending?: boolean
}

// ── The contract ─────────────────────────────────────────────────────────────

export interface Backend {
  auth: {
    /** The signed-in user's profile, or null when there is no session */
    me(): Promise<Profile | null>
    /** Fires with true on sign in / token refresh and false on sign out; returns an unsubscribe */
    onChange(listener: (signedIn: boolean) => void): () => void
    signIn(email: string, password: string): Promise<Result>
    signOut(): Promise<void>
    updateMe(patch: Pick<ProfilePatch, 'full_name' | 'avatar_initials'>): Promise<Result<Profile>>
    /** The server verifies the current password first */
    changePassword(newPassword: string, currentPassword: string): Promise<Result>
  }

  profiles: {
    list(opts?: { limit?: number }): Promise<Result<Profile[]>>
    /** Admin only: creates the login and the profile in one step (there is no public sign-up) */
    create(input: NewUserInput): Promise<Result<Profile>>
    /** Admin edit of anyone's name, role or department */
    update(id: string, patch: ProfilePatch): Promise<Result<Profile>>
  }

  departments: {
    /** member_count is filled when withMemberCount is set */
    list(opts?: { activeOnly?: boolean; withMemberCount?: boolean }): Promise<Result<Department[]>>
    save(input: DepartmentInput, id?: string): Promise<Result<Department>>
    remove(id: string): Promise<Result>
  }

  projects: {
    /** spent_amount is filled when withSpend is set */
    list(opts?: { activeOnly?: boolean; withSpend?: boolean }): Promise<Result<Project[]>>
    save(input: ProjectInput, id?: string): Promise<Result<Project>>
    remove(id: string): Promise<Result>
  }

  vendors: {
    list(opts?: { activeOnly?: boolean }): Promise<Result<Vendor[]>>
    get(id: string): Promise<Result<Vendor>>
    save(input: VendorInput, id?: string): Promise<Result<Vendor>>
    history(id: string): Promise<Result<VendorHistory>>
  }

  purchases: {
    /** Newest first, with project and requester */
    list(): Promise<Result<PurchaseRequest[]>>
    /** With items, quotations (+vendor), approvals (+reviewer) and attachments (+uploader) */
    get(id: string): Promise<Result<PurchaseRequest>>
    count(filter: PurchaseCountFilter): Promise<Result<number>>
    /** Always a draft for the signed-in user; the request number is assigned by the server */
    create(input: RequestInput): Promise<Result<{ id: string }>>
    update(id: string, input: RequestInput): Promise<Result>
    remove(id: string): Promise<Result>
    replaceItems(id: string, items: ItemInput[]): Promise<Result>
    addQuotation(requestId: string, quote: QuotationInput): Promise<Result>
    removeQuotation(quoteId: string): Promise<Result>
    selectQuotation(requestId: string, quoteId: string): Promise<Result>
    // Workflow: role checks, no self-approval, audit and notifications all happen server side
    submit(id: string): Promise<Result>
    decide(id: string, decision: Decision, comment?: string | null, approvedAmount?: number | null): Promise<Result>
    recordPurchase(id: string, actualAmount: number): Promise<Result>
    complete(id: string): Promise<Result>
  }

  attachments: {
    upload(requestId: string, file: File, type: AttachmentType, description?: string): Promise<Result>
    /** A short-lived link to open the file */
    url(attachment: Pick<PurchaseAttachment, 'id' | 'file_path' | 'file_url'>): Promise<Result<string>>
  }

  labor: {
    list(): Promise<Result<LaborRequest[]>>
    get(id: string): Promise<Result<LaborRequest>>
    create(input: LaborInput): Promise<Result>
    update(id: string, patch: LaborPatch): Promise<Result>
  }

  audit: {
    /** Read only: the server writes an event for every change */
    list(query?: AuditQuery): Promise<Result<AuditEvent[]>>
  }

  notifications: {
    list(limit: number): Promise<Result<AppNotification[]>>
    markRead(id: string): Promise<Result>
    markAllRead(): Promise<Result>
    remove(ids: string[]): Promise<Result>
    /** Live inserts/updates/deletes for the signed-in user; returns an unsubscribe */
    subscribe(userId: string, handlers: NotificationHandlers): () => void
  }
}

export interface NotificationHandlers {
  onInsert(n: AppNotification): void
  onUpdate(n: AppNotification): void
  onDelete(id: string): void
}
