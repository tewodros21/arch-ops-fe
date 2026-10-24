import { backend, type PurchaseCountFilter, type QuotationInput, type RequestInput, type ItemInput } from '@/api'
import { attachFile } from '@/lib/storage'
import type { Department, PurchaseRequest, Project, Vendor } from '@/types'

export type { ItemInput, RequestInput } from '@/api'

// Fired after a purchase request is created or edited so open pages can reload
export const PURCHASE_SAVED_EVENT = 'purchase-request-saved'

export function announcePurchaseSaved(id: string) {
  window.dispatchEvent(new CustomEvent(PURCHASE_SAVED_EVENT, { detail: { id } }))
}

export async function fetchPurchaseRequests(): Promise<PurchaseRequest[]> {
  const { data, error } = await backend.purchases.list()
  if (error) console.error('Error fetching purchase requests:', error)
  return data ?? []
}

export async function fetchPurchaseRequestById(id: string): Promise<PurchaseRequest | null> {
  const { data, error } = await backend.purchases.get(id)
  if (error) console.error(`Error fetching request ${id}:`, error)
  return data
}

export async function countPurchaseRequests(filter: PurchaseCountFilter): Promise<number> {
  const { data } = await backend.purchases.count(filter)
  return data ?? 0
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await backend.projects.list({ activeOnly: true })
  if (error) console.error('Error fetching projects:', error)
  return data ?? []
}

export async function fetchActiveVendors(): Promise<Vendor[]> {
  const { data } = await backend.vendors.list({ activeOnly: true })
  return data ?? []
}

/** Empty when the table is missing or unseeded; callers fall back to free text */
export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await backend.departments.list({ activeOnly: true })
  return data ?? []
}

// ── Create / edit ────────────────────────────────────────────────────────────

export interface QuoteInput extends QuotationInput {
  file: File | null
}

type Result = { error: string | null }

/** Always a draft for the signed-in user; request_number comes from the server */
export async function createPurchaseRequest(input: RequestInput): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await backend.purchases.create(input)
  return { id: data?.id ?? null, error: error?.message ?? null }
}

/** Only the requester's own draft / quote_received requests can be edited; status is never touched here */
export async function updatePurchaseRequest(id: string, input: RequestInput): Promise<Result> {
  const { error } = await backend.purchases.update(id, input)
  return { error: error?.message ?? null }
}

export async function replaceItems(requestId: string, items: ItemInput[]): Promise<Result> {
  const { error } = await backend.purchases.replaceItems(requestId, items)
  return { error: error?.message ?? null }
}

/** Adding a quote to a draft moves it to Quote Received (server side) */
export async function addQuotation(requestId: string, quote: QuoteInput): Promise<Result & { fileError?: string | null }> {
  const { file, ...fields } = quote
  const { error } = await backend.purchases.addQuotation(requestId, fields)
  if (error) return { error: error.message }
  if (file) {
    const { error: fileError } = await attachFile(requestId, file, 'quotation', 'Quotation from vendor')
    return { error: null, fileError }
  }
  return { error: null }
}

export async function deleteQuotations(ids: string[]): Promise<Result> {
  for (const id of ids) {
    const { error } = await backend.purchases.removeQuotation(id)
    if (error) return { error: error.message }
  }
  return { error: null }
}

/** Only one quote per request is selected at a time */
export async function selectQuotation(requestId: string, quoteId: string): Promise<Result> {
  const { error } = await backend.purchases.selectQuotation(requestId, quoteId)
  return { error: error?.message ?? null }
}

/** Requesters can delete their own drafts; items, quotes and attachments go with them */
export async function deletePurchaseRequest(id: string): Promise<Result> {
  const { error } = await backend.purchases.remove(id)
  return { error: error?.message ?? null }
}
