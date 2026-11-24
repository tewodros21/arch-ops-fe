import type {
  AppNotification,
  AttachmentType,
  AuditEvent,
  Department,
  LaborRequest,
  PurchaseAttachment,
  PurchaseDuplicate,
  Profile,
  Project,
  PurchaseRequest,
  RequestStatus,
  Role,
  SupplierPaymentMethod,
  SupplierSuggestion,
  SiteEmployee,
  Vendor,
  VendorQuotation,
} from '@/types'

// The contract the data source implements. The UI talks to `backend` (src/api/index.ts) through
// src/services, so screens never call the Django REST API (public/docs/openapi.yaml) directly.

/** Normalized so the UI can react to a cause without knowing HTTP codes */
export type ErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'account_deactivated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'in_use'
  | 'sent_back'
  | 'with_requester'
  | 'network'
  | 'unknown'

export interface ApiError {
  message: string
  code: ErrorCode
}

export type Result<T = null> = { data: T | null; error: ApiError | null }

// ── Inputs ───────────────────────────────────────────────────────────────────

export interface SupplierPaymentAccountInput {
  bank_name: string
  account_number: string
  account_holder_name: string
  phone_number: string
}

export interface RequestInput {
  title: string
  description: string
  project_id: string
  project_ids: string[]
  department: string
  estimated_amount: number
  proforma_amount: number
  vendor_name: string
  vendor_location: string
  supplier_payment_method: SupplierPaymentMethod | ''
  supplier_bank_name: string
  supplier_account_number: string
  supplier_account_holder_name: string
  supplier_phone_number: string
  supplier_payment_accounts: SupplierPaymentAccountInput[]
  project_suppliers: {
    project_id: string
    supplier_name: string
    supplier_address: string
    supplier_phone: string
    payment_method: SupplierPaymentMethod | ''
    bank_name: string
    account_number: string
    account_holder_name?: string
    phone_number?: string
    payment_accounts?: SupplierPaymentAccountInput[]
  }[]
  justification: string
  required_date: string | null
}

export interface ItemInput {
  project_id?: string | null
  name: string
  quantity: number
  unit: string
  estimated_unit_price: number | null
  description: string | null
}

export interface ItemReceiptInput {
  id: string
  quantity_received: number
}

export interface QuotationInput {
  vendor_id: string
  amount: number
  valid_until: string | null
  notes: string | null
}

export type VendorInput = Pick<Vendor, 'name' | 'contact_person' | 'phone' | 'email' | 'services' | 'address'> & {
  is_active: boolean
}

export type ProjectInput = Pick<Project, 'name' | 'code' | 'client_name' | 'location' | 'budget' | 'is_active'> & {
  /** Assigns (or with null clears) the project's PM */
  project_manager_id?: string | null
}
export type DepartmentInput = Pick<Department, 'name' | 'is_active'>
export type SiteEmployeeInput = Pick<SiteEmployee, 'full_name' | 'department' | 'is_active' | 'notes'>
export type SiteEmployeePatch = Partial<SiteEmployeeInput>

export interface ProfilePatch {
  full_name?: string
  avatar_initials?: string
  role?: Role
  is_active?: boolean
  has_all_projects?: boolean
  project_ids?: string[]
  assigned_project_ids?: string[]
  password?: string
}

/** An admin adding a teammate; they sign in with the temporary password and change it on first login */
export interface NewUserInput {
  email: string
  full_name: string
  role: Role
  password: string
  has_all_projects?: boolean
  project_ids?: string[]
  assigned_project_ids?: string[]
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

export type Decision = 'approve' | 'reject'

export interface ReceiptInput {
  items: { purchase_item_id: string; quantity_received: number }[]
  note?: string
}

// ── Read models ──────────────────────────────────────────────────────────────

export type VendorRequestSummary = Pick<
  PurchaseRequest,
  'id' | 'request_number' | 'title' | 'status' | 'created_at' | 'estimated_amount' | 'approved_amount' | 'actual_amount'
> & { project?: { name: string } | null }

export interface VendorQuoteRow extends Omit<VendorQuotation, 'vendor'> {
  request: VendorRequestSummary | null
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
    /** Emails a reset link; the reply is the same whether or not the account exists */
    requestPasswordReset(email: string): Promise<Result>
    /** Sets a new password from the emailed link (uid + token) */
    confirmPasswordReset(uid: string, token: string, newPassword: string): Promise<Result>
  }

  profiles: {
    list(opts?: { limit?: number }): Promise<Result<Profile[]>>
    /** Admin only: creates the login and the profile in one step (there is no public sign-up) */
    create(input: NewUserInput): Promise<Result<Profile>>
    /** Admin edit of a login user's profile, role and project assignments */
    update(id: string, patch: ProfilePatch): Promise<Result<Profile>>
    /** Admin only: permanent delete, refused with in_use when the user has any history */
    remove(id: string): Promise<Result>
  }

  departments: {
    /** member_count is filled when withMemberCount is set */
    list(opts?: { activeOnly?: boolean; withMemberCount?: boolean }): Promise<Result<Department[]>>
    save(input: DepartmentInput, id?: string): Promise<Result<Department>>
    remove(id: string): Promise<Result>
  }

  siteEmployees: {
    list(opts?: { department?: string; activeOnly?: boolean; search?: string }): Promise<Result<SiteEmployee[]>>
    create(input: SiteEmployeeInput): Promise<Result<SiteEmployee>>
    update(id: string, patch: SiteEmployeePatch): Promise<Result<SiteEmployee>>
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
    checkDuplicates(
      items: { project_id: string; name: string }[],
      excludeRequestId?: string,
    ): Promise<Result<PurchaseDuplicate[]>>
    /** Suppliers from past requests matching the query (requester roles only) */
    supplierSuggestions(query: string): Promise<Result<SupplierSuggestion[]>>
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
    updateReceivedItems(id: string, items: ItemReceiptInput[]): Promise<Result>
    receive(id: string, input: ReceiptInput): Promise<Result>
    complete(id: string): Promise<Result>
  }

  attachments: {
    upload(requestId: string, file: File, type: AttachmentType, description?: string, projectId?: string): Promise<Result>
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
