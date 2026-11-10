import { backend, type VendorHistory, type VendorInput } from '@/api'
import type { Role, Vendor } from '@/types'

export type { VendorHistory, VendorInput, VendorQuoteRow, VendorRequestSummary } from '@/api'

/** Mirrors the API's vendor permissions */
export const VENDOR_MANAGER_ROLES: Role[] = ['admin', 'finance']

export async function fetchVendors(): Promise<Vendor[]> {
  const { data, error } = await backend.vendors.list()
  if (error) console.error('Error fetching vendors:', error)
  return data ?? []
}

export async function fetchVendor(id: string): Promise<Vendor | null> {
  const { data, error } = await backend.vendors.get(id)
  if (error && error.code !== 'not_found') console.error(`Error fetching vendor ${id}:`, error)
  return data
}

/** Creates a vendor, or updates it when an id is given */
export async function saveVendor(input: VendorInput, id?: string): Promise<{ data: Vendor | null; error: string | null }> {
  const { data, error } = await backend.vendors.save(input, id)
  return { data, error: error?.message ?? null }
}

/** Legacy Proforma history for a vendor, including historical competing prices and files. */
export async function fetchVendorHistory(vendorId: string): Promise<VendorHistory> {
  const { data, error } = await backend.vendors.history(vendorId)
  if (error) console.error(`Error fetching quotations for vendor ${vendorId}:`, error)
  return data ?? { quotes: [], documents: [] }
}
