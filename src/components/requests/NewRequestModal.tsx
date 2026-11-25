import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { format } from 'date-fns'
import { ArrowRight, Building2, CalendarDays, Check, FileText, Info, Layers, Package, Pencil, Plus, ReceiptText, Trash2, Upload, X } from 'lucide-react'
import { notify } from '@/lib/notify'
import { ACCEPT_ATTR, attachFile, formatBytes, validateFile } from '@/lib/storage'
import { EDITABLE_STATUSES, submitRequest } from '@/lib/workflow'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils'
import { ReviewTile, StepField as Field, StepModal, type Step } from '@/components/ui/StepModal'
import { SupplierNameField } from './SupplierNameField'
import {
  announcePurchaseSaved,
  createPurchaseRequest,
  fetchPurchaseDuplicates,
  fetchProjects,
  fetchPurchaseRequestById,
  replaceItems,
  updatePurchaseRequest,
  type RequestInput,
} from '@/services/requests'
import { PAYMENT_METHOD_LABELS, type Project, type PurchaseDuplicate, type SupplierPaymentAccount, type SupplierPaymentMethod, type SupplierSuggestion } from '@/types'

interface ItemRow {
  /** Which selected project the line is for; empty means the first selected project */
  project_id: string
  name: string
  quantity: string
  unit: string
  unit_price: string
  description: string
}

interface SupplierFields {
  supplier_name: string
  supplier_address: string
  supplier_phone: string
  payment_method: SupplierPaymentMethod | ''
  bank_name: string
  account_number: string
  payment_accounts: SupplierPaymentAccount[]
}

const EMPTY_ACCOUNT: SupplierPaymentAccount = {
  bank_name: '',
  account_number: '',
  account_holder_name: '',
  phone_number: '',
}

const EMPTY_SUPPLIER: SupplierFields = {
  supplier_name: '',
  supplier_address: '',
  supplier_phone: '',
  payment_method: '',
  bank_name: '',
  account_number: '',
  payment_accounts: [{ ...EMPTY_ACCOUNT }],
}

const EMPTY_ITEM: ItemRow = { project_id: '', name: '', quantity: '1', unit: 'unit', unit_price: '', description: '' }
const UNITS = [
  'unit', 'each', 'pcs', 'pair', 'pack', 'set', 'box', 'bag', 'sack', 'bucket', 'drum',
  'm', 'cm', 'mm', 'm²', 'm³', 'ft', 'roll', 'sheet', 'board', 'length', 'bundle', 'pallet', 'load',
  'brick', 'block', 'tile', 'kg', 'g', 'ton', 'litre', 'mL',
  'hour', 'day', 'week', 'month', 'year', 'service', 'lot', 'license', 'seat',
]

const STEPS: Step[] = [
  { title: 'Details', hint: 'Requested by, project location and reason' },
  { title: 'Materials', hint: 'Material type, quantity and price per piece' },
  { title: 'Total & timing', hint: 'Total price, due date and reason' },
  { title: 'Supplier & Proforma', hint: 'Supplier, payment accounts and Proforma (optional)' },
  { title: 'Review', hint: 'Save a draft or submit' },
]

const inputClass =
  'focus-ring w-full rounded-2xl border bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink)] placeholder:text-slate-400 transition-colors focus:border-[var(--ink)] focus:bg-white'

function money(value: string | number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? formatCurrency(n) : '—'
}

const itemStarted = (r: ItemRow) => !!(r.name.trim() || r.unit_price || r.description.trim())
const lineTotal = (r: ItemRow) => (Number(r.quantity) || 0) * (Number(r.unit_price) || 0)

/** Create a purchase request, or edit a draft when `editId` is given */
export function NewRequestModal({ onClose, editId }: { onClose: () => void; editId?: string }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const editing = !!editId
  const [step, setStep] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(editing)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectLoadFailed, setProjectLoadFailed] = useState(false)
  const [duplicateMatches, setDuplicateMatches] = useState<PurchaseDuplicate[]>([])
  const [duplicateCheckError, setDuplicateCheckError] = useState(false)
  const [touched, setTouched] = useState(false)
  /** Step-3 target (by element id) currently flashing the attention ring */
  const [highlightId, setHighlightId] = useState<string | null>(null)
  /** Deferred scroll/focus timer and the highlight-clear timer, cleared on rerun/unmount */
  const scrollTimerRef = useRef<number | null>(null)
  const highlightTimerRef = useRef<number | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }])
  const [proformaFiles, setProformaFiles] = useState<Record<string, File | null>>({})
  const [existingProformas, setExistingProformas] = useState<Record<string, string>>({})
  const [splitSuppliers, setSplitSuppliers] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    /** Selected projects in the order picked; the first is the primary project */
    project_ids: [] as string[],
    department: profile?.department ?? 'General',
    suppliers: {} as Record<string, SupplierFields>,
    supplier_payment_method: '' as SupplierPaymentMethod | '',
    payment_accounts: [{ ...EMPTY_ACCOUNT }] as SupplierPaymentAccount[],
    justification: '',
    required_date: '',
  })

  function applyProjectsResult({ data, error }: Awaited<ReturnType<typeof fetchProjects>>) {
    setLoadingProjects(false)
    if (error) {
      console.error('Error fetching projects:', error)
      setProjectLoadFailed(true)
      notify.error('Could not load projects')
      return
    }
    setProjectLoadFailed(false)
    setProjects(data ?? [])
  }

  async function loadProjects() {
    applyProjectsResult(await fetchProjects())
  }

  useEffect(() => {
    let active = true
    void fetchProjects().then((result) => {
      if (active) applyProjectsResult(result)
    })
    return () => {
      active = false
    }
  }, [])

  // Clear pending scroll/highlight timers on unmount
  useEffect(() => () => {
    if (scrollTimerRef.current != null) window.clearTimeout(scrollTimerRef.current)
    if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current)
  }, [])

  useEffect(() => {
    if (step !== 1) return
    const candidates = items
      .filter((item) => item.name.trim())
      .map((item) => ({ project_id: form.project_ids.includes(item.project_id) ? item.project_id : (form.project_ids[0] ?? ''), name: item.name.trim() }))
      .filter((item) => item.project_id)
    if (candidates.length === 0) {
      setDuplicateMatches([])
      setDuplicateCheckError(false)
      return
    }

    setDuplicateMatches([])
    setDuplicateCheckError(false)
    let active = true
    const timeout = window.setTimeout(() => {
      void fetchPurchaseDuplicates(candidates, editId).then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Could not check for duplicate purchase items:', error)
          setDuplicateCheckError(true)
          setDuplicateMatches([])
          return
        }
        setDuplicateCheckError(false)
        setDuplicateMatches(data)
      })
    }, 350)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [step, items, form.project_ids, editId])

  // Edit mode: prefill from the saved request
  useEffect(() => {
    if (!editId || !profile) return
    fetchPurchaseRequestById(editId).then((r) => {
      if (!r || r.requester_id !== profile.id || !EDITABLE_STATUSES.includes(r.status)) {
        notify.warning('This request can no longer be edited')
        onClose()
        return
      }
      const savedItems = r.items ?? []
      const savedAccounts =
        r.supplier_payment_accounts?.length
          ? r.supplier_payment_accounts.map((account) => ({
              bank_name: account.bank_name ?? '',
              account_number: account.account_number ?? '',
              account_holder_name: account.account_holder_name ?? '',
              phone_number: account.phone_number ?? '',
            }))
          : r.supplier_account_number || r.supplier_bank_name || r.supplier_account_holder_name || r.supplier_phone_number
            ? [
                {
                  bank_name: r.supplier_bank_name ?? '',
                  account_number: r.supplier_account_number ?? '',
                  account_holder_name: r.supplier_account_holder_name ?? '',
                  phone_number: r.supplier_phone_number ?? '',
                },
              ]
            : [{ ...EMPTY_ACCOUNT }]
      setForm({
        title: r.title,
        description: r.description ?? '',
        project_ids: r.project_ids?.length ? r.project_ids : [r.project_id],
        department: r.department ?? profile.department ?? 'General',
        suppliers: (r.project_suppliers ?? []).reduce<Record<string, SupplierFields>>((all, supplier) => {
          const supplierAccounts = supplier.payment_accounts?.length
            ? supplier.payment_accounts
            : supplier.account_number || supplier.bank_name
              ? [{
                  bank_name: supplier.bank_name ?? '',
                  account_number: supplier.account_number ?? '',
                  account_holder_name: supplier.account_holder_name ?? '',
                  phone_number: supplier.phone_number ?? '',
                }]
              : [{ ...EMPTY_ACCOUNT }]
          all[supplier.project_id] = {
            supplier_name: supplier.supplier_name ?? '',
            supplier_address: supplier.supplier_address ?? '',
            supplier_phone: supplier.supplier_phone ?? '',
            payment_method: supplier.payment_method ?? '',
            bank_name: supplier.bank_name ?? '',
            account_number: supplier.account_number ?? '',
            payment_accounts: supplierAccounts,
          }
          return all
        }, {
          [r.project_id]: {
            ...EMPTY_SUPPLIER,
            supplier_name: r.vendor_name ?? r.quotations?.[0]?.vendor?.name ?? '',
            supplier_address: r.vendor_location ?? r.quotations?.[0]?.vendor?.address ?? '',
            payment_method: r.supplier_payment_method ?? '',
            bank_name: r.supplier_bank_name ?? '',
            account_number: r.supplier_account_number ?? '',
            payment_accounts: savedAccounts.length ? savedAccounts : [{ ...EMPTY_ACCOUNT }],
          },
        }),
        supplier_payment_method: r.supplier_payment_method ?? r.project_suppliers?.[0]?.payment_method ?? '',
        payment_accounts:
          savedAccounts.some(
            (account) =>
              account.bank_name || account.account_number || account.account_holder_name || account.phone_number,
          )
            ? savedAccounts
            : r.project_suppliers?.[0]?.account_number || r.project_suppliers?.[0]?.bank_name
              ? [
                  {
                    bank_name: r.project_suppliers[0].bank_name ?? '',
                    account_number: r.project_suppliers[0].account_number ?? '',
                    account_holder_name: r.supplier_account_holder_name ?? '',
                    phone_number: r.supplier_phone_number ?? '',
                  },
                ]
              : [{ ...EMPTY_ACCOUNT }],
        justification: r.justification ?? '',
        required_date: r.required_date ?? '',
      })
      setItems(
        savedItems.length
          ? savedItems.map((i) => ({
              project_id: i.project_id ?? r.project_id,
              name: i.name,
              quantity: String(i.quantity),
              unit: i.unit,
              unit_price: i.estimated_unit_price != null ? String(i.estimated_unit_price) : '',
              description: i.description ?? '',
            }))
          : [{ ...EMPTY_ITEM }],
      )
      const proformas: Record<string, string> = {}
      for (const attachment of r.attachments ?? []) {
        if (attachment.attachment_type === 'proforma') {
          if (attachment.project_id || !r.project_suppliers?.length) {
            proformas[attachment.project_id ?? r.project_id] = attachment.file_name
          }
        }
      }
      const savedProjectSuppliers = r.project_suppliers ?? []
      if (savedProjectSuppliers.length > 1) {
        const first = savedProjectSuppliers[0]
        const hasDifferences = savedProjectSuppliers.slice(1).some(
          (s) =>
            (s.supplier_name ?? '') !== (first.supplier_name ?? '') ||
            (s.supplier_address ?? '') !== (first.supplier_address ?? '') ||
            (s.supplier_phone ?? '') !== (first.supplier_phone ?? ''),
        )
        if (hasDifferences) {
          setSplitSuppliers(true)
        }
      }
      setExistingProformas(proformas)
      setLoadingEdit(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, profile?.id])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setTouched(true)
    setForm((f) => ({ ...f, [key]: value }))
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setTouched(true)
    setItems((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function updateSupplier(projectId: string, key: keyof SupplierFields, value: any) {
    setTouched(true)
    setForm((f) => {
      if (!splitSuppliers && f.project_ids.length > 1) {
        // Keep all selected projects synced to the single supplier form
        const nextSuppliers = { ...f.suppliers }
        for (const pid of f.project_ids) {
          nextSuppliers[pid] = { ...(nextSuppliers[pid] ?? EMPTY_SUPPLIER), [key]: value }
        }
        return {
          ...f,
          suppliers: nextSuppliers,
          ...(key === 'payment_method' ? { supplier_payment_method: value } : {}),
          ...(key === 'payment_accounts' ? { payment_accounts: value } : {}),
        }
      }
      return {
        ...f,
        suppliers: {
          ...f.suppliers,
          [projectId]: { ...(f.suppliers[projectId] ?? EMPTY_SUPPLIER), [key]: value },
        },
        ...(projectId === f.project_ids[0]
          ? {
              ...(key === 'payment_method' ? { supplier_payment_method: value } : {}),
              ...(key === 'payment_accounts' ? { payment_accounts: value } : {}),
            }
          : {}),
      }
    })
  }

  function updateSupplierAccount(projectId: string, index: number, patch: Partial<SupplierPaymentAccount>) {
    setTouched(true)
    setForm((f) => {
      if (!splitSuppliers && f.project_ids.length > 1) {
        const nextSuppliers = { ...f.suppliers }
        const currentAccounts = f.suppliers[projectId]?.payment_accounts ?? [{ ...EMPTY_ACCOUNT }]
        const nextAccounts = currentAccounts.map((account, i) => (i === index ? { ...account, ...patch } : account))
        for (const pid of f.project_ids) {
          nextSuppliers[pid] = { ...(nextSuppliers[pid] ?? EMPTY_SUPPLIER), payment_accounts: nextAccounts }
        }
        return { ...f, suppliers: nextSuppliers, payment_accounts: nextAccounts }
      }
      const supplier = f.suppliers[projectId] ?? EMPTY_SUPPLIER
      const currentAccounts = supplier.payment_accounts?.length ? supplier.payment_accounts : [{ ...EMPTY_ACCOUNT }]
      const nextAccounts = currentAccounts.map((account, i) => (i === index ? { ...account, ...patch } : account))
      return {
        ...f,
        suppliers: {
          ...f.suppliers,
          [projectId]: { ...supplier, payment_accounts: nextAccounts },
        },
        ...(projectId === f.project_ids[0] ? { payment_accounts: nextAccounts } : {}),
      }
    })
  }

  function addSupplierAccount(projectId: string) {
    setTouched(true)
    setForm((f) => {
      if (!splitSuppliers && f.project_ids.length > 1) {
        const nextSuppliers = { ...f.suppliers }
        const currentAccounts = f.suppliers[projectId]?.payment_accounts ?? [{ ...EMPTY_ACCOUNT }]
        const nextAccounts = [...currentAccounts, { ...EMPTY_ACCOUNT }]
        for (const pid of f.project_ids) {
          nextSuppliers[pid] = { ...(nextSuppliers[pid] ?? EMPTY_SUPPLIER), payment_accounts: nextAccounts }
        }
        return { ...f, suppliers: nextSuppliers, payment_accounts: nextAccounts }
      }
      const supplier = f.suppliers[projectId] ?? EMPTY_SUPPLIER
      const currentAccounts = supplier.payment_accounts?.length ? supplier.payment_accounts : [{ ...EMPTY_ACCOUNT }]
      const nextAccounts = [...currentAccounts, { ...EMPTY_ACCOUNT }]
      return {
        ...f,
        suppliers: {
          ...f.suppliers,
          [projectId]: { ...supplier, payment_accounts: nextAccounts },
        },
        ...(projectId === f.project_ids[0] ? { payment_accounts: nextAccounts } : {}),
      }
    })
  }

  function removeSupplierAccount(projectId: string, index: number) {
    setTouched(true)
    setForm((f) => {
      if (!splitSuppliers && f.project_ids.length > 1) {
        const nextSuppliers = { ...f.suppliers }
        const currentAccounts = f.suppliers[projectId]?.payment_accounts ?? [{ ...EMPTY_ACCOUNT }]
        const nextAccounts = currentAccounts.length <= 1 ? [{ ...EMPTY_ACCOUNT }] : currentAccounts.filter((_, i) => i !== index)
        for (const pid of f.project_ids) {
          nextSuppliers[pid] = { ...(nextSuppliers[pid] ?? EMPTY_SUPPLIER), payment_accounts: nextAccounts }
        }
        return { ...f, suppliers: nextSuppliers, payment_accounts: nextAccounts }
      }
      const supplier = f.suppliers[projectId] ?? EMPTY_SUPPLIER
      const currentAccounts = supplier.payment_accounts?.length ? supplier.payment_accounts : [{ ...EMPTY_ACCOUNT }]
      const nextAccounts = currentAccounts.length <= 1 ? [{ ...EMPTY_ACCOUNT }] : currentAccounts.filter((_, i) => i !== index)
      return {
        ...f,
        suppliers: {
          ...f.suppliers,
          [projectId]: { ...supplier, payment_accounts: nextAccounts },
        },
        ...(projectId === f.project_ids[0] ? { payment_accounts: nextAccounts } : {}),
      }
    })
  }

  /** Apply a picked suggestion: name/address/phone and payment details go to that project's block (or synced across projects if single supplier) */
  function applySupplierSuggestion(projectId: string, suggestion: SupplierSuggestion) {
    setTouched(true)
    const accounts = suggestion.payment_accounts.length > 0
      ? suggestion.payment_accounts.map((account) => ({
          bank_name: account.bank_name ?? '',
          account_number: account.account_number ?? '',
          account_holder_name: account.account_holder_name ?? '',
          phone_number: account.phone_number ?? '',
        }))
      : [{ ...EMPTY_ACCOUNT }]

    const method = suggestion.payment_method || ''
    const finalAccounts = method === 'telebirr' ? accounts.slice(0, 1) : accounts

    if (!splitSuppliers && form.project_ids.length > 1) {
      setForm((f) => {
        const nextSuppliers = { ...f.suppliers }
        for (const pid of f.project_ids) {
          nextSuppliers[pid] = {
            ...(nextSuppliers[pid] ?? EMPTY_SUPPLIER),
            supplier_name: suggestion.supplier_name,
            supplier_address: suggestion.supplier_address,
            supplier_phone: suggestion.supplier_phone,
            ...(method ? { payment_method: method } : {}),
            ...(suggestion.payment_accounts.length > 0 ? { payment_accounts: finalAccounts } : {}),
          }
        }
        return {
          ...f,
          suppliers: nextSuppliers,
          ...(method ? { supplier_payment_method: method } : {}),
          ...(suggestion.payment_accounts.length > 0 ? { payment_accounts: finalAccounts } : {}),
        }
      })
    } else {
      setForm((f) => {
        const currentSupplier = f.suppliers[projectId] ?? EMPTY_SUPPLIER
        const updatedSupplier: SupplierFields = {
          ...currentSupplier,
          supplier_name: suggestion.supplier_name,
          supplier_address: suggestion.supplier_address,
          supplier_phone: suggestion.supplier_phone,
          ...(method ? { payment_method: method } : {}),
          ...(suggestion.payment_accounts.length > 0 ? { payment_accounts: finalAccounts } : {}),
        }
        return {
          ...f,
          suppliers: { ...f.suppliers, [projectId]: updatedSupplier },
          ...(projectId === f.project_ids[0]
            ? {
                ...(method ? { supplier_payment_method: method } : {}),
                ...(suggestion.payment_accounts.length > 0 ? { payment_accounts: finalAccounts } : {}),
              }
            : {}),
        }
      })
    }
  }

  function toggleProject(id: string) {
    setTouched(true)
    setForm((f) => ({
      ...f,
      project_ids: f.project_ids.includes(id) ? f.project_ids.filter((p) => p !== id) : [...f.project_ids, id],
      suppliers: { ...f.suppliers, [id]: f.suppliers[id] ?? { ...EMPTY_SUPPLIER } },
    }))
  }

  function addItem(projectId: string) {
    setTouched(true)
    setItems((rows) => [...rows, { ...EMPTY_ITEM, project_id: projectId }])
  }

  const selectedProjects = form.project_ids
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => !!p)
  const multiProject = form.project_ids.length > 1
  // Lines for a project that is no longer selected fall back to the first selected project
  const projectOf = (r: ItemRow) => (form.project_ids.includes(r.project_id) ? r.project_id : (form.project_ids[0] ?? ''))
  const filledItems = items.filter(itemStarted)
  const itemsTotal = filledItems.reduce((sum, r) => sum + lineTotal(r), 0)
  const totalFor = (projectId: string) => filledItems.filter((r) => projectOf(r) === projectId).reduce((sum, r) => sum + lineTotal(r), 0)
  const emptyProject = multiProject ? selectedProjects.find((p) => !filledItems.some((r) => projectOf(r) === p.id)) : undefined
  const hasSupplierDetails = form.project_ids.length > 0 && form.project_ids.every((id) => {
    const supplier = form.suppliers[id] ?? EMPTY_SUPPLIER
    return !!(supplier.supplier_name.trim() && supplier.supplier_address.trim() && supplier.supplier_phone.trim())
  })
  const filledAccounts = form.payment_accounts.filter(
    (account) =>
      account.bank_name.trim() ||
      account.account_number.trim() ||
      account.account_holder_name.trim() ||
      account.phone_number.trim(),
  )
  const primaryAccount = filledAccounts[0]

  function getProjectAccounts(projectId: string) {
    const supplier = form.suppliers[projectId]
    const list = supplier?.payment_accounts?.length ? supplier.payment_accounts : form.payment_accounts
    return list.filter(
      (account) =>
        account.bank_name.trim() ||
        account.account_number.trim() ||
        account.account_holder_name.trim() ||
        account.phone_number.trim(),
    )
  }

  function getProjectPaymentMethod(projectId: string): SupplierPaymentMethod | '' {
    return form.suppliers[projectId]?.payment_method || form.supplier_payment_method
  }

  const hasPaymentDetails = multiProject && splitSuppliers
    ? selectedProjects.every((p) => {
        const method = getProjectPaymentMethod(p.id)
        const accounts = getProjectAccounts(p.id)
        return !!(
          method &&
          accounts[0]?.account_number.trim() &&
          (method !== 'bank' || accounts[0]?.bank_name.trim())
        )
      })
    : !!(
        form.supplier_payment_method
        && primaryAccount?.account_number.trim()
        && (form.supplier_payment_method !== 'bank' || primaryAccount.bank_name.trim())
      )

  function validatePaymentFor(method: SupplierPaymentMethod | '', accounts: SupplierPaymentAccount[], projectLabel?: string) {
    const prefix = projectLabel ? `${projectLabel}: ` : ''
    if (method === 'telebirr') {
      const first = accounts[0]
      const digits = (first?.account_number ?? '').replace(/\D/g, '')
      if (first?.account_number.trim() && !/^[\d\s+-]+$/.test(first.account_number.trim())) {
        return `${prefix}Use digits only for the Telebirr number`
      }
      if (digits && (digits.length < 9 || digits.length > 12)) {
        return `${prefix}Enter a valid Telebirr phone number, e.g. 0912345678`
      }
      return null
    }
    for (const [index, account] of accounts.entries()) {
      if (account.account_number.trim() && !/^[\d\s+-]+$/.test(account.account_number.trim())) {
        return `${prefix}Account ${index + 1}: use digits only for the account number`
      }
      if (account.phone_number.trim() && !/^[\d\s+-]+$/.test(account.phone_number.trim())) {
        return `${prefix}Account ${index + 1}: use digits only for the phone number`
      }
    }
    return null
  }

  const paymentError = (() => {
    if (multiProject && splitSuppliers) {
      for (const project of selectedProjects) {
        const method = getProjectPaymentMethod(project.id)
        const supplier = form.suppliers[project.id]
        const accounts = supplier?.payment_accounts?.length ? supplier.payment_accounts : form.payment_accounts
        const err = validatePaymentFor(method, accounts, project.name)
        if (err) return err
      }
      return null
    }
    return validatePaymentFor(form.supplier_payment_method, form.payment_accounts)
  })()
  const attachedProformas = selectedProjects.filter((project) => !!(proformaFiles[project.id] || existingProformas[project.id])).length
  const hasProformas = selectedProjects.length > 0 && attachedProformas === selectedProjects.length

  /** One entry per concrete gap blocking submission; drives the Review-step banner links */
  interface MissingItem { targetId: string; label: string }
  const missingItems: MissingItem[] = []
  if (multiProject && !splitSuppliers) {
    const primaryId = form.project_ids[0]
    const supplier = form.suppliers[primaryId] ?? EMPTY_SUPPLIER
    if (!supplier.supplier_name.trim()) {
      missingItems.push({ targetId: `supplier-name-${primaryId}`, label: 'Supplier name' })
    }
    if (!supplier.supplier_address.trim()) {
      missingItems.push({ targetId: `supplier-address-${primaryId}`, label: 'Supplier address' })
    }
    if (!supplier.supplier_phone.trim()) {
      missingItems.push({ targetId: `supplier-phone-${primaryId}`, label: 'Supplier phone' })
    }
    if (!form.supplier_payment_method) {
      missingItems.push({ targetId: 'payment-method', label: 'Payment method' })
    } else {
      if (!(primaryAccount?.account_number ?? '').trim()) {
        missingItems.push({ targetId: 'account-number-0', label: 'Account number' })
      }
      if (form.supplier_payment_method === 'bank' && !(primaryAccount?.bank_name ?? '').trim()) {
        missingItems.push({ targetId: 'bank-name-0', label: 'Bank name' })
      }
    }
  } else {
    for (const project of selectedProjects) {
      const supplier = form.suppliers[project.id] ?? EMPTY_SUPPLIER
      if (!supplier.supplier_name.trim()) {
        missingItems.push({ targetId: `supplier-name-${project.id}`, label: `Supplier name for ${project.name}` })
      }
      if (!supplier.supplier_address.trim()) {
        missingItems.push({ targetId: `supplier-address-${project.id}`, label: `Supplier address for ${project.name}` })
      }
      if (!supplier.supplier_phone.trim()) {
        missingItems.push({ targetId: `supplier-phone-${project.id}`, label: `Supplier phone for ${project.name}` })
      }
      const projectMethod = supplier.payment_method || form.supplier_payment_method
      const projectAccounts = supplier.payment_accounts?.length ? supplier.payment_accounts : form.payment_accounts
      const firstAcc = projectAccounts[0]
      if (!projectMethod) {
        missingItems.push({ targetId: `payment-method-${project.id}`, label: `Payment method for ${project.name}` })
      } else {
        if (!(firstAcc?.account_number ?? '').trim()) {
          missingItems.push({ targetId: `account-number-${project.id}-0`, label: `Account number for ${project.name}` })
        }
        if (projectMethod === 'bank' && !(firstAcc?.bank_name ?? '').trim()) {
          missingItems.push({ targetId: `bank-name-${project.id}-0`, label: `Bank name for ${project.name}` })
        }
      }
    }
  }

  const badItem = filledItems.find((r) => !r.name.trim() || !(Number(r.quantity) > 0) || !(Number(r.unit_price) > 0))
  const projectError = loadingProjects
    ? 'Projects are still loading. Please wait a moment.'
    : projectLoadFailed
      ? 'Could not load projects. Try again.'
      : projects.length === 0
        ? 'No active projects are available. Ask an admin to add or activate one before creating a purchase request.'
        : 'Choose the project location for this purchase'

  const stepErrors: Record<number, string | null> = {
    0: !form.title.trim() ? 'Add a short title for this request' : !form.project_ids.length ? projectError : null,
    1: !filledItems.length
      ? 'Add at least one material'
      : badItem
        ? 'Each material needs a type, quantity and price per piece'
        : emptyProject
          ? `Add at least one material for ${emptyProject.name}, or remove that project`
          : null,
    2: null,
    3: paymentError,
    4: null,
  }

  function next() {
    const error = stepErrors[step]
    if (error) {
      setShowErrors(true)
      notify.warning(error)
      return
    }
    setShowErrors(false)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goTo(target: number) {
    // Only allow jumping forward past steps that are already valid
    for (let s = 0; s < target; s++) {
      if (stepErrors[s]) {
        setStep(s)
        setShowErrors(true)
        return
      }
    }
    setShowErrors(false)
    setStep(target)
  }

  /** Jump from the Review banner to a missing field on step 3: navigate, scroll it into view, then focus or highlight it */
  function goToMissing(targetId: string) {
    setShowErrors(true) // keep existing error styling consistent
    setStep(3)
    setHighlightId(targetId)
    if (scrollTimerRef.current != null) window.clearTimeout(scrollTimerRef.current)
    if (highlightTimerRef.current != null) window.clearTimeout(highlightTimerRef.current)
    // Deferred so step 3 mounts first (steps render conditionally)
    scrollTimerRef.current = window.setTimeout(() => {
      const el = document.getElementById(targetId)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
    }, 60)
    highlightTimerRef.current = window.setTimeout(() => setHighlightId(null), 2000)
  }

  async function save(submitAfter: boolean) {
    // Success navigates to the request, which closes this modal
    if (!profile || loadingEdit) return
    const firstInvalid = Object.keys(stepErrors).map(Number).find((s) => stepErrors[s])
    if (firstInvalid !== undefined) {
      goTo(firstInvalid + 1)
      notify.warning(stepErrors[firstInvalid]!)
      return
    }
    if (submitAfter && (!hasSupplierDetails || !hasPaymentDetails)) {
      setShowErrors(true)
      setStep(3)
      notify.warning('Complete supplier, contact, and payment details for every selected project')
      return
    }
    setBusy(true)

    const primarySupplier = form.suppliers[form.project_ids[0]] ?? EMPTY_SUPPLIER
    const accountsPayload = filledAccounts.map((account) => ({
      bank_name: account.bank_name.trim(),
      account_number: account.account_number.trim(),
      account_holder_name: account.account_holder_name.trim(),
      phone_number: account.phone_number.trim(),
    }))
    const method =
      accountsPayload.length === 0
        ? ''
        : form.supplier_payment_method || 'bank'
    const input: RequestInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      project_id: form.project_ids[0],
      project_ids: form.project_ids,
      department: form.department.trim() || 'General',
      estimated_amount: itemsTotal,
      proforma_amount: itemsTotal,
      vendor_name: primarySupplier.supplier_name.trim(),
      vendor_location: primarySupplier.supplier_address.trim(),
      supplier_payment_method: method,
      supplier_bank_name: method === 'bank' ? (accountsPayload[0]?.bank_name ?? '') : '',
      supplier_account_number: accountsPayload[0]?.account_number ?? '',
      supplier_account_holder_name: accountsPayload[0]?.account_holder_name ?? '',
      supplier_phone_number: accountsPayload[0]?.phone_number ?? '',
      supplier_payment_accounts: method === 'telebirr' ? accountsPayload.slice(0, 1) : accountsPayload,
      project_suppliers: form.project_ids.map((project_id) => {
        const supplier = form.suppliers[project_id] ?? EMPTY_SUPPLIER
        const sAccounts = (supplier.payment_accounts?.length ? supplier.payment_accounts : form.payment_accounts).filter(
          (acc) => acc.bank_name.trim() || acc.account_number.trim() || acc.account_holder_name.trim() || acc.phone_number.trim(),
        )
        const sMethod = supplier.payment_method || method
        return {
          project_id,
          supplier_name: supplier.supplier_name.trim(),
          supplier_address: supplier.supplier_address.trim(),
          supplier_phone: supplier.supplier_phone.trim(),
          payment_method: sMethod,
          bank_name: sMethod === 'bank' ? (sAccounts[0]?.bank_name ?? '') : '',
          account_number: sAccounts[0]?.account_number ?? '',
          account_holder_name: sAccounts[0]?.account_holder_name ?? '',
          phone_number: sAccounts[0]?.phone_number ?? '',
          payment_accounts: sAccounts.map((account) => ({
            bank_name: account.bank_name.trim(),
            account_number: account.account_number.trim(),
            account_holder_name: account.account_holder_name.trim(),
            phone_number: account.phone_number.trim(),
          })),
        }
      }),
      justification: form.justification.trim(),
      required_date: form.required_date || null,
    }

    let id = editId ?? null
    if (editId) {
      const { error } = await updatePurchaseRequest(editId, input)
      if (error) {
        setBusy(false)
        notify.error(`Could not save changes: ${error}`)
        return
      }
    } else {
      const created = await createPurchaseRequest(input)
      if (created.error || !created.id) {
        setBusy(false)
        notify.error(`Could not create request: ${created.error ?? 'unknown error'}`)
        return
      }
      id = created.id
    }
    const requestId = id!

    const { error: itemsError } = await replaceItems(
      requestId,
      filledItems.map((r) => ({
        project_id: projectOf(r),
        name: r.name.trim(),
        quantity: Number(r.quantity),
        unit: r.unit.trim() || 'unit',
        estimated_unit_price: r.unit_price === '' ? null : Number(r.unit_price),
        description: r.description.trim() || null,
      })),
    )
    if (itemsError) {
      setBusy(false)
      notify.error(`Request saved, but line items could not be saved: ${itemsError}`)
      announcePurchaseSaved(requestId)
      navigate(`/requests/${requestId}`)
      return
    }

    for (const project of selectedProjects) {
      const file = proformaFiles[project.id]
      if (!file) continue
      const { error } = await attachFile(
        requestId,
        file,
        'proforma',
        `Supplier Proforma - ${project.name}`,
        project.id,
      )
      if (error) {
        setBusy(false)
        notify.error(`Request saved, but the Proforma for ${project.name} could not be uploaded: ${error}`)
        return
      }
      setExistingProformas((current) => ({ ...current, [project.id]: file.name }))
      setProformaFiles((current) => ({ ...current, [project.id]: null }))
    }

    if (submitAfter) {
      const { error } = await submitRequest(requestId)
      if (error) {
        setBusy(false)
        notify.error(`Saved as draft, not submitted: ${error}`)
        announcePurchaseSaved(requestId)
        navigate(`/requests/${requestId}`)
        return
      }
      else notify.success('Request submitted for Finance review')
    } else {
      notify.success(editing ? 'Draft changes saved' : 'Draft saved, complete the supplier details before submitting')
    }

    setBusy(false)
    announcePurchaseSaved(requestId)
    navigate(`/requests/${requestId}`)
  }

  const projectNames = selectedProjects.map((p) => p.name).join(' + ')
  const err = (s: number, when: boolean) => showErrors && step === s && when

  return (
    <StepModal
      title={editing ? 'Edit purchase request' : 'New purchase request'}
      icon={editing ? Pencil : ReceiptText}
      steps={STEPS}
      step={step}
      onNext={next}
      onBack={() => setStep((s) => s - 1)}
      onGoTo={goTo}
      onSubmit={() => save(true)}
      submitLabel="Submit for Finance review"
      submitDisabled={!hasSupplierDetails || !hasPaymentDetails}
      secondaryAction={{ label: editing ? 'Save changes' : 'Save as draft', onClick: () => save(false) }}
      discardPrompt={editing ? 'Discard your changes?' : 'Discard this request?'}
      busy={busy}
      dirty={touched}
      onClose={onClose}
      summary={
        <>
          <p className="truncate text-sm text-white">{form.title || 'Untitled request'}</p>
          <div className="flex items-end justify-between gap-2">
            <span className="truncate text-xs text-white/50">
              {projectNames || 'No project yet'}
              {filledItems.length > 0 && ` · ${filledItems.length} item${filledItems.length === 1 ? '' : 's'}`}
            </span>
            <span className="text-xl font-bold text-white">{money(itemsTotal)}</span>
          </div>
          <div className="flex items-center gap-1.5 border-t border-white/10 pt-3 text-[11px] text-white/55">
            {profile?.role === 'project_manager' ? (
              <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 font-semibold text-[var(--ink)]">Finance</span>
            ) : (
              <>
                <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 font-semibold text-[var(--ink)]">Project Manager</span>
                <ArrowRight size={12} />
                <span>Finance</span>
              </>
            )}
          </div>
        </>
      }
    >
      {loadingEdit && <p className="py-16 text-center text-sm text-slate-500">Loading request…</p>}

      {!loadingEdit && step === 0 && (
        <>
          <Field label="Requested By">
            <input
              value={profile?.full_name || profile?.email || ''}
              readOnly
              className={clsx(inputClass, 'border-transparent bg-[var(--canvas)] text-[var(--ink-soft)]')}
            />
          </Field>

          <Field label="Title" error={err(0, !form.title.trim())}>
            <input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. AI control room final board work"
              className={clsx(inputClass, 'text-base', err(0, !form.title.trim()) ? 'border-[var(--accent)]' : 'border-transparent')}
            />
          </Field>

          <Field label="Project Location" error={err(0, !form.project_ids.length)}>
            <p className="mb-2 text-xs text-slate-500">Pick one project, or several when the same supplier delivers for more than one.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {projects.map((p) => {
                const active = form.project_ids.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProject(p.id)}
                    aria-pressed={active}
                    className={clsx(
                      'focus-ring flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all',
                      active ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-black/10 hover:border-black/30',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                        active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--canvas)] text-[var(--ink)]',
                      )}
                    >
                      {active ? <Check size={17} strokeWidth={2.5} /> : <Building2 size={17} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className={clsx('block truncate text-xs', active ? 'text-white/55' : 'text-slate-500')}>
                        {[p.code, p.location, p.client_name].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </button>
                )
              })}
              {loadingProjects && <p className="text-sm text-slate-500">Loading projects…</p>}
              {!loadingProjects && projectLoadFailed && (
                <div role="alert" className="text-sm text-[var(--accent)]">
                  Could not load projects.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => {
                      setLoadingProjects(true)
                      setProjectLoadFailed(false)
                      void loadProjects()
                    }}
                  >
                    Try again
                  </button>
                </div>
              )}
              {!loadingProjects && !projectLoadFailed && projects.length === 0 && (
                <p className="text-sm text-slate-500">No active projects are available. Ask an admin to add or activate a project before creating a purchase request.</p>
              )}
            </div>
          </Field>

          <Field label="Reason for material" optional>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              rows={3}
              placeholder="Why is this material needed?"
              className={clsx(inputClass, 'resize-none border-transparent')}
            />
          </Field>
        </>
      )}

      {!loadingEdit && step === 1 && (
        <>
          <p className="text-sm text-[var(--ink-soft)]">
            List each material with quantity and price per piece. Total price is calculated for you.
          </p>
          <datalist id="item-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          {(multiProject ? selectedProjects : [null]).map((group) => {
            const groupId = group?.id ?? form.project_ids[0] ?? ''
            const rows = items.map((r, i) => ({ r, i })).filter(({ r }) => !multiProject || projectOf(r) === groupId)
            return (
              <section key={groupId || 'single'} className={clsx('space-y-3', multiProject && 'rounded-[1.75rem] bg-[var(--canvas)]/60 p-3')}>
                {group && (
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--ink)]">
                      <Building2 size={15} className="shrink-0 text-[var(--accent)]" />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-[var(--ink)]">{money(totalFor(group.id))}</span>
                  </div>
                )}
                {rows.map(({ r, i }, n) => {
                  const invalid = showErrors && step === 1 && itemStarted(r) && (!r.name.trim() || !(Number(r.quantity) > 0) || !(Number(r.unit_price) > 0))
                  return (
                    <div key={i} className={clsx('rounded-[1.5rem] border bg-white p-4', invalid ? 'border-[var(--accent)]' : 'border-black/10')}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                          <Package size={15} className="text-slate-400" />
                          Material {n + 1}
                        </span>
                        <span className="flex items-center gap-2">
                          {lineTotal(r) > 0 && <span className="text-sm font-bold text-[var(--ink)]">{money(lineTotal(r))}</span>}
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setTouched(true)
                                setItems((all) => all.filter((_, idx) => idx !== i))
                              }}
                              aria-label={`Remove material ${n + 1}${group ? ` for ${group.name}` : ''}`}
                              className="focus-ring rounded-full p-1.5 text-slate-400 transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </span>
                      </div>
                      <input
                        value={r.name}
                        onChange={(e) => updateItem(i, { name: e.target.value })}
                        placeholder="Material type, e.g. Board"
                        aria-label={`Material ${n + 1} type`}
                        className={clsx(inputClass, 'border-transparent')}
                      />
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={r.quantity}
                          onChange={(e) => updateItem(i, { quantity: e.target.value })}
                          placeholder="Quantity"
                          aria-label={`Material ${n + 1} quantity`}
                          className={clsx(inputClass, 'border-transparent')}
                        />
                        <input
                          list="item-units"
                          value={r.unit}
                          onChange={(e) => updateItem(i, { unit: e.target.value })}
                          placeholder="Unit"
                          aria-label={`Material ${n + 1} unit`}
                          className={clsx(inputClass, 'border-transparent')}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={r.unit_price}
                          onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                          placeholder="Price per piece"
                          aria-label={`Material ${n + 1} price per piece`}
                          className={clsx(inputClass, invalid && !(Number(r.unit_price) > 0) ? 'border-[var(--accent)]' : 'border-transparent')}
                        />
                      </div>
                      <input
                        value={r.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        placeholder="Specs or notes (optional)"
                        aria-label={`Material ${n + 1} notes`}
                        className={clsx(inputClass, 'mt-2 border-transparent')}
                      />
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => addItem(groupId)}
                  className="focus-ring flex w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-black/10 py-4 text-sm font-medium text-[var(--ink)] transition-colors hover:border-black/30"
                >
                  <Plus size={16} />
                  {group ? `Add material for ${group.name}` : 'Add another material'}
                </button>
              </section>
            )
          })}
          <div className="flex items-center justify-between rounded-[1.5rem] bg-[var(--ink)] px-5 py-4 text-white">
            <span className="text-sm text-white/70">
              {filledItems.length} material{filledItems.length === 1 ? '' : 's'} · total price
            </span>
            <span className="text-2xl font-black tracking-tight">{money(itemsTotal)}</span>
          </div>
          {duplicateCheckError && (
            <p role="status" className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-slate-600">
              Could not check for similar requests right now. You can continue, but please review the request list for possible duplicates.
            </p>
          )}
          {duplicateMatches.length > 0 && (
            <div role="status" className="rounded-[1.5rem] border border-[var(--sun)] bg-[var(--sun-soft)] p-4">
              <p className="text-sm font-bold text-[var(--ink)]">Possible duplicate items found</p>
              <p className="mt-1 text-xs text-[var(--ink-soft)]">This is a warning only; you can still submit the request.</p>
              <ul className="mt-3 space-y-2">
                {duplicateMatches.slice(0, 5).map((match) => (
                  <li key={`${match.id}-${match.project_id}`} className="text-sm text-[var(--ink)]">
                    <span className="font-semibold">{match.item_name}</span> for {match.project_name} already appears in{' '}
                    <span className="font-semibold">{match.request_number}</span> ({match.title}, {match.status.replace(/_/g, ' ')}).
                  </li>
                ))}
                {duplicateMatches.length > 5 && (
                  <li className="text-xs text-[var(--ink-soft)]">{duplicateMatches.length - 5} more possible matches</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}

      {!loadingEdit && step === 2 && (
        <>
          <div className="rounded-[1.5rem] bg-[var(--canvas)] px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total Price</p>
            <p className="mt-1 text-4xl font-black tracking-tight text-[var(--ink)] sm:text-5xl">{money(itemsTotal)}</p>
            {multiProject && (
              <ul className="mt-3 space-y-1 border-t border-black/[0.06] pt-3 text-sm">
                {selectedProjects.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 text-[var(--ink-soft)]">
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 font-semibold text-[var(--ink)]">{money(totalFor(p.id))}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setStep(1)} className="mt-2 text-xs font-semibold text-[var(--ink)] underline underline-offset-2">
              Change materials or prices
            </button>
          </div>

          <Field label="Needed by" optional>
            <div className="relative">
              <CalendarDays size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={form.required_date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => update('required_date', e.target.value)}
                className={clsx(inputClass, 'border-transparent pl-11')}
              />
            </div>
          </Field>

          <Field label="Extra notes for reviewers" optional>
            <textarea
              value={form.justification}
              onChange={(e) => update('justification', e.target.value)}
              rows={4}
              placeholder="Anything else reviewers should know."
              className={clsx(inputClass, 'resize-none border-transparent')}
            />
          </Field>
        </>
      )}

      {!loadingEdit && step === 3 && (
        <>
          <p className="text-sm text-[var(--ink-soft)]">
            {multiProject && !splitSuppliers
              ? 'Enter supplier contact details and attach Proforma documents for your purchase, then add payment accounts.'
              : 'Enter supplier contact details, attach a Proforma, and add payment accounts for each project.'}
          </p>
          {multiProject && !splitSuppliers ? (
            (() => {
              const primaryProjectId = form.project_ids[0]
              const supplier = form.suppliers[primaryProjectId] ?? EMPTY_SUPPLIER
              const currentAccounts = supplier.payment_accounts?.length ? supplier.payment_accounts : form.payment_accounts
              const currentMethod = supplier.payment_method || form.supplier_payment_method
              return (
                <section className="space-y-4 rounded-[1.5rem] border border-black/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--ink)]">
                      <Building2 size={16} className="shrink-0 text-[var(--accent)]" />
                      <span className="truncate">Supplier for {selectedProjects.map((p) => p.name).join(' & ')}</span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[var(--ink)]">{money(itemsTotal)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Supplier or company name">
                      <SupplierNameField
                        id={`supplier-name-${primaryProjectId}`}
                        value={supplier.supplier_name}
                        onChange={(value) => updateSupplier(primaryProjectId, 'supplier_name', value)}
                        onSelect={(suggestion) => applySupplierSuggestion(primaryProjectId, suggestion)}
                        placeholder="Supplier or company name"
                        aria-label="Supplier or company name"
                      />
                    </Field>
                    <Field label="Supplier address">
                      <input
                        id={`supplier-address-${primaryProjectId}`}
                        value={supplier.supplier_address}
                        onChange={(e) => updateSupplier(primaryProjectId, 'supplier_address', e.target.value)}
                        placeholder="City, site, or address"
                        className={clsx(inputClass, 'border-transparent')}
                      />
                    </Field>
                    <Field label="Supplier contact phone">
                      <input
                        id={`supplier-phone-${primaryProjectId}`}
                        type="tel"
                        value={supplier.supplier_phone}
                        onChange={(e) => updateSupplier(primaryProjectId, 'supplier_phone', e.target.value)}
                        placeholder="Supplier phone number"
                        className={clsx(inputClass, 'border-transparent')}
                      />
                    </Field>
                  </div>

                  <div className="space-y-3 border-t border-black/[0.06] pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Proforma Documents
                    </p>
                    {selectedProjects.map((project) => (
                      <div key={project.id} className="space-y-1.5">
                        {existingProformas[project.id] && (
                          <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink-soft)]">
                            Attached Proforma ({project.name}):{' '}
                            <span className="font-semibold text-[var(--ink)]">{existingProformas[project.id]}</span>
                          </p>
                        )}
                        <Field label={`Proforma for ${project.name} (${money(totalFor(project.id))})`}>
                          <DropZone
                            id={`proforma-${project.id}`}
                            highlighted={highlightId === `proforma-${project.id}`}
                            file={proformaFiles[project.id] ?? null}
                            onFile={(file) => {
                              setTouched(true)
                              setProformaFiles((current) => ({ ...current, [project.id]: file }))
                            }}
                          />
                        </Field>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 border-t border-black/[0.06] pt-3">
                    <Field label="Payment accounts">
                      <div
                        id="payment-method"
                        role="group"
                        aria-label="Payment method"
                        className={clsx(
                          'grid grid-cols-2 gap-2 rounded-2xl transition-shadow',
                          highlightId === 'payment-method' && 'ring-2 ring-[var(--accent)]',
                        )}
                      >
                        {(Object.keys(PAYMENT_METHOD_LABELS) as SupplierPaymentMethod[]).map((method) => {
                          const active = currentMethod === method
                          return (
                            <button
                              key={method}
                              type="button"
                              aria-pressed={active}
                              onClick={() => {
                                const newAccounts = active ? [{ ...EMPTY_ACCOUNT }] : method === 'telebirr' ? [currentAccounts[0] ?? { ...EMPTY_ACCOUNT }] : currentAccounts
                                updateSupplier(primaryProjectId, 'payment_method', active ? '' : method)
                                updateSupplier(primaryProjectId, 'payment_accounts', newAccounts)
                              }}
                              className={clsx(
                                'focus-ring rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
                                active ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-black/10 text-[var(--ink)] hover:border-black/30',
                              )}
                            >
                              {PAYMENT_METHOD_LABELS[method]}
                            </button>
                          )
                        })}
                      </div>

                      {currentMethod === 'telebirr' && (
                        <div className="mt-3 space-y-2">
                          <input
                            id="account-number-0"
                            value={currentAccounts[0]?.account_number ?? ''}
                            onChange={(e) =>
                              updateSupplierAccount(primaryProjectId, 0, {
                                account_number: e.target.value,
                                bank_name: '',
                                account_holder_name: currentAccounts[0]?.account_holder_name ?? '',
                              })
                            }
                            inputMode="numeric"
                            placeholder="Telebirr phone number, e.g. 0912345678"
                            aria-label="Telebirr number"
                            className={clsx(inputClass, err(3, !!paymentError) ? 'border-[var(--accent)]' : 'border-transparent')}
                          />
                          <input
                            value={currentAccounts[0]?.account_holder_name ?? ''}
                            onChange={(e) => updateSupplierAccount(primaryProjectId, 0, { account_holder_name: e.target.value })}
                            placeholder="Account holder name"
                            aria-label="Account holder name"
                            className={clsx(inputClass, 'border-transparent')}
                          />
                        </div>
                      )}

                      {(currentMethod === 'bank' || !currentMethod) && (
                        <div className="mt-3 space-y-3">
                          {currentAccounts.map((account, index) => (
                            <div key={index} className="rounded-[1.25rem] border border-black/10 bg-white p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-[var(--ink)]">Account {index + 1}</p>
                                {currentAccounts.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeSupplierAccount(primaryProjectId, index)}
                                    aria-label={`Remove account ${index + 1}`}
                                    className="focus-ring rounded-full p-1.5 text-slate-400 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <input
                                  id={`bank-name-${index}`}
                                  value={account.bank_name}
                                  onChange={(e) => updateSupplierAccount(primaryProjectId, index, { bank_name: e.target.value })}
                                  placeholder="Bank name, e.g. CBE"
                                  aria-label={`Bank name for account ${index + 1}`}
                                  className={clsx(inputClass, 'border-transparent')}
                                />
                                <input
                                  id={`account-number-${index}`}
                                  value={account.account_number}
                                  onChange={(e) => updateSupplierAccount(primaryProjectId, index, { account_number: e.target.value })}
                                  inputMode="numeric"
                                  placeholder="Account number"
                                  aria-label={`Account number ${index + 1}`}
                                  className={clsx(inputClass, err(3, !!paymentError) ? 'border-[var(--accent)]' : 'border-transparent')}
                                />
                                <input
                                  value={account.account_holder_name}
                                  onChange={(e) => updateSupplierAccount(primaryProjectId, index, { account_holder_name: e.target.value })}
                                  placeholder="Account holder name"
                                  aria-label={`Account holder name ${index + 1}`}
                                  className={clsx(inputClass, 'border-transparent')}
                                />
                                <input
                                  value={account.phone_number}
                                  onChange={(e) => updateSupplierAccount(primaryProjectId, index, { phone_number: e.target.value })}
                                  inputMode="tel"
                                  placeholder="Phone number"
                                  aria-label={`Phone number ${index + 1}`}
                                  className={clsx(inputClass, 'border-transparent')}
                                />
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addSupplierAccount(primaryProjectId)}
                            className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 py-3 text-sm font-medium text-[var(--ink)] hover:border-black/30"
                          >
                            <Plus size={16} />
                            Add another account
                          </button>
                        </div>
                      )}
                      {err(3, !!paymentError) && <p className="mt-2 text-xs font-medium text-[var(--accent)]">{paymentError}</p>}
                      <p className="mt-2 text-xs text-slate-500">Only Finance, Admin, and the requester can see payment details. Add every bank account the supplier uses.</p>
                    </Field>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTouched(true)
                        setSplitSuppliers(true)
                      }}
                      className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-[var(--canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--ink)] transition-colors hover:border-black/25 hover:bg-white"
                    >
                      <Layers size={14} className="text-[var(--accent)]" />
                      Use different suppliers for each project
                    </button>
                  </div>
                </section>
              )
            })()
          ) : (
            <>
              {selectedProjects.map((project) => {
                const supplier = form.suppliers[project.id] ?? EMPTY_SUPPLIER
                const currentAccounts = supplier.payment_accounts?.length ? supplier.payment_accounts : [{ ...EMPTY_ACCOUNT }]
                const currentMethod = supplier.payment_method || ''
                return (
                  <section key={project.id} className="space-y-4 rounded-[1.5rem] border border-black/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-[var(--ink)]">
                        <Building2 size={16} className="shrink-0 text-[var(--accent)]" />
                        <span className="truncate">{project.name}</span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-[var(--ink)]">{money(totalFor(project.id))}</span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Supplier or company name">
                        <SupplierNameField
                          id={`supplier-name-${project.id}`}
                          value={supplier.supplier_name}
                          onChange={(value) => updateSupplier(project.id, 'supplier_name', value)}
                          onSelect={(suggestion) => applySupplierSuggestion(project.id, suggestion)}
                          placeholder="Supplier or company name"
                          aria-label={`Supplier name for ${project.name}`}
                        />
                      </Field>
                      <Field label="Supplier address">
                        <input
                          id={`supplier-address-${project.id}`}
                          value={supplier.supplier_address}
                          onChange={(e) => updateSupplier(project.id, 'supplier_address', e.target.value)}
                          placeholder="City, site, or address"
                          className={clsx(inputClass, 'border-transparent')}
                        />
                      </Field>
                      <Field label="Supplier contact phone">
                        <input
                          id={`supplier-phone-${project.id}`}
                          type="tel"
                          value={supplier.supplier_phone}
                          onChange={(e) => updateSupplier(project.id, 'supplier_phone', e.target.value)}
                          placeholder="Supplier phone number"
                          className={clsx(inputClass, 'border-transparent')}
                        />
                      </Field>
                    </div>

                    {existingProformas[project.id] && (
                      <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink-soft)]">
                        Attached Proforma: <span className="font-semibold text-[var(--ink)]">{existingProformas[project.id]}</span>
                      </p>
                    )}
                    <Field label={`Proforma for ${project.name}`}>
                      <DropZone
                        id={`proforma-${project.id}`}
                        highlighted={highlightId === `proforma-${project.id}`}
                        file={proformaFiles[project.id] ?? null}
                        onFile={(file) => {
                          setTouched(true)
                          setProformaFiles((current) => ({ ...current, [project.id]: file }))
                        }}
                      />
                    </Field>

                    <div className="space-y-3 border-t border-black/[0.06] pt-3">
                      <Field label={`Payment accounts for ${project.name}`}>
                        <div
                          id={`payment-method-${project.id}`}
                          role="group"
                          aria-label={`Payment method for ${project.name}`}
                          className={clsx(
                            'grid grid-cols-2 gap-2 rounded-2xl transition-shadow',
                            highlightId === `payment-method-${project.id}` && 'ring-2 ring-[var(--accent)]',
                          )}
                        >
                          {(Object.keys(PAYMENT_METHOD_LABELS) as SupplierPaymentMethod[]).map((method) => {
                            const active = currentMethod === method
                            return (
                              <button
                                key={method}
                                type="button"
                                aria-pressed={active}
                                onClick={() => {
                                  const newAccounts = active ? [{ ...EMPTY_ACCOUNT }] : method === 'telebirr' ? [currentAccounts[0] ?? { ...EMPTY_ACCOUNT }] : currentAccounts
                                  updateSupplier(project.id, 'payment_method', active ? '' : method)
                                  updateSupplier(project.id, 'payment_accounts', newAccounts)
                                }}
                                className={clsx(
                                  'focus-ring rounded-2xl border px-4 py-3 text-sm font-medium transition-colors',
                                  active ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-black/10 text-[var(--ink)] hover:border-black/30',
                                )}
                              >
                                {PAYMENT_METHOD_LABELS[method]}
                              </button>
                            )
                          })}
                        </div>

                        {currentMethod === 'telebirr' && (
                          <div className="mt-3 space-y-2">
                            <input
                              id={`account-number-${project.id}-0`}
                              value={currentAccounts[0]?.account_number ?? ''}
                              onChange={(e) =>
                                updateSupplierAccount(project.id, 0, {
                                  account_number: e.target.value,
                                  bank_name: '',
                                  account_holder_name: currentAccounts[0]?.account_holder_name ?? '',
                                })
                              }
                              inputMode="numeric"
                              placeholder="Telebirr phone number, e.g. 0912345678"
                              aria-label={`Telebirr number for ${project.name}`}
                              className={clsx(inputClass, err(3, !!paymentError) ? 'border-[var(--accent)]' : 'border-transparent')}
                            />
                            <input
                              value={currentAccounts[0]?.account_holder_name ?? ''}
                              onChange={(e) => updateSupplierAccount(project.id, 0, { account_holder_name: e.target.value })}
                              placeholder="Account holder name"
                              aria-label={`Account holder name for ${project.name}`}
                              className={clsx(inputClass, 'border-transparent')}
                            />
                          </div>
                        )}

                        {(currentMethod === 'bank' || !currentMethod) && (
                          <div className="mt-3 space-y-3">
                            {currentAccounts.map((account, index) => (
                              <div key={index} className="rounded-[1.25rem] border border-black/10 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-[var(--ink)]">Account {index + 1}</p>
                                  {currentAccounts.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removeSupplierAccount(project.id, index)}
                                      aria-label={`Remove account ${index + 1} for ${project.name}`}
                                      className="focus-ring rounded-full p-1.5 text-slate-400 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <input
                                    id={`bank-name-${project.id}-${index}`}
                                    value={account.bank_name}
                                    onChange={(e) => updateSupplierAccount(project.id, index, { bank_name: e.target.value })}
                                    placeholder="Bank name, e.g. CBE"
                                    aria-label={`Bank name for account ${index + 1} (${project.name})`}
                                    className={clsx(inputClass, 'border-transparent')}
                                  />
                                  <input
                                    id={`account-number-${project.id}-${index}`}
                                    value={account.account_number}
                                    onChange={(e) => updateSupplierAccount(project.id, index, { account_number: e.target.value })}
                                    inputMode="numeric"
                                    placeholder="Account number"
                                    aria-label={`Account number ${index + 1} (${project.name})`}
                                    className={clsx(inputClass, err(3, !!paymentError) ? 'border-[var(--accent)]' : 'border-transparent')}
                                  />
                                  <input
                                    value={account.account_holder_name}
                                    onChange={(e) => updateSupplierAccount(project.id, index, { account_holder_name: e.target.value })}
                                    placeholder="Account holder name"
                                    aria-label={`Account holder name ${index + 1} (${project.name})`}
                                    className={clsx(inputClass, 'border-transparent')}
                                  />
                                  <input
                                    value={account.phone_number}
                                    onChange={(e) => updateSupplierAccount(project.id, index, { phone_number: e.target.value })}
                                    inputMode="tel"
                                    placeholder="Phone number"
                                    aria-label={`Phone number ${index + 1} (${project.name})`}
                                    className={clsx(inputClass, 'border-transparent')}
                                  />
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addSupplierAccount(project.id)}
                              className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/10 py-3 text-sm font-medium text-[var(--ink)] hover:border-black/30"
                            >
                              <Plus size={16} />
                              Add another account
                            </button>
                          </div>
                        )}
                      </Field>
                    </div>
                  </section>
                )
              })}
              {multiProject && splitSuppliers && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTouched(true)
                      const primary = form.suppliers[form.project_ids[0]] ?? EMPTY_SUPPLIER
                      setForm((f) => {
                        const nextSuppliers = { ...f.suppliers }
                        for (const pid of f.project_ids) {
                          nextSuppliers[pid] = { ...primary }
                        }
                        return {
                          ...f,
                          suppliers: nextSuppliers,
                          supplier_payment_method: primary.payment_method || f.supplier_payment_method,
                          payment_accounts: primary.payment_accounts?.length ? primary.payment_accounts : f.payment_accounts,
                        }
                      })
                      setSplitSuppliers(false)
                    }}
                    className="focus-ring text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    Use one supplier for both projects
                  </button>
                </div>
              )}
            </>
          )}
          <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink-soft)]">
            Each selected project needs its own supplier details; a Proforma is optional. Project line totals add up to{' '}
            <span className="font-semibold text-[var(--ink)]">{money(itemsTotal)}</span>.
          </p>
        </>
      )}

      {!loadingEdit && step === 4 && (
        <>
          <div className="rounded-[1.5rem] bg-[var(--canvas)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{projectNames}</p>
                <p className="mt-1 text-xl font-bold text-[var(--ink)]">{form.title}</p>
                {form.description && <p className="mt-1 text-sm text-[var(--ink-soft)]">{form.description}</p>}
              </div>
              <p className="text-4xl font-black tracking-tight text-[var(--ink)]">{money(itemsTotal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReviewTile
              label="Materials"
              value={filledItems.length ? `${filledItems.length} · ${money(itemsTotal)}` : 'None listed'}
              onEdit={() => setStep(1)}
            />
            <ReviewTile
              label="Needed by"
              value={form.required_date ? format(new Date(`${form.required_date}T00:00`), 'MMM d, yyyy') : 'Not set'}
              onEdit={() => setStep(2)}
            />
            <ReviewTile
              label="Pay to"
              value={
                filledAccounts.length
                  ? filledAccounts
                      .map((account) =>
                        [account.bank_name, account.account_number, account.account_holder_name].filter(Boolean).join(' · '),
                      )
                      .join(' | ')
                  : 'Not provided'
              }
              onEdit={() => setStep(3)}
            />
            <ReviewTile
              label="Supplier / Proforma"
              value={
                !hasSupplierDetails
                  ? 'Incomplete'
                  : `${attachedProformas} of ${selectedProjects.length} Proforma${selectedProjects.length === 1 ? '' : 's'} attached`
              }
              onEdit={() => setStep(3)}
            />
          </div>

          {filledItems.length > 0 && (
            <div className="rounded-[1.5rem] border border-black/10 p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Materials</p>
              <ul className="mt-2 divide-y divide-black/[0.05]">
                {filledItems.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-[var(--ink)]">
                      {r.name}
                      <span className="text-slate-500">
                        {' '}· {r.quantity} × {money(Number(r.unit_price) || 0)}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-[var(--ink)]">{money(lineTotal(r))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(form.description || form.justification) && (
            <div className="rounded-[1.5rem] border border-black/10 p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Reason for material</p>
              <p className="mt-2 text-sm text-[var(--ink)]">{form.description || form.justification}</p>
            </div>
          )}

          {!hasSupplierDetails || !hasPaymentDetails ? (
            <div className="flex items-start gap-3 rounded-[1.5rem] bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--accent)]">
                <Info size={16} />
              </span>
              <span className="min-w-0">
                Complete the following to submit:
                <span className="mt-1.5 flex flex-col items-start gap-1">
                  {missingItems.map((item) => (
                    <button
                      key={item.targetId}
                      type="button"
                      onClick={() => goToMissing(item.targetId)}
                      className="focus-ring rounded text-left font-semibold underline underline-offset-2"
                    >
                      {item.label}
                    </button>
                  ))}
                </span>
                <span className="mt-1.5 block">or save this as a draft for now.</span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[1.5rem] bg-[var(--sun-soft)] p-4 text-sm text-[var(--ink)]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sun)]">
                <ArrowRight size={16} />
              </span>
              <span>
                {profile?.role === 'project_manager'
                  ? 'Submitting sends this request directly to Finance for review.'
                  : 'Submitting sends this request to the assigned Project Manager, then Finance.'}
                {hasProformas ? " Each project's Proforma is attached to the request." : ''}
              </span>
            </div>
          )}
        </>
      )}
    </StepModal>
  )
}

function DropZone({ id, highlighted = false, file, onFile }: { id?: string; highlighted?: boolean; file: File | null; onFile: (file: File | null) => void }) {
  const [over, setOver] = useState(false)

  function pick(next: File | null | undefined) {
    if (!next) return
    const problem = validateFile(next)
    if (problem) {
      notify.warning(problem)
      return
    }
    onFile(next)
  }

  if (file) {
    return (
      <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[var(--canvas)] px-4 py-3">
        <FileText size={18} className="shrink-0 text-[var(--accent)]" />
        <span className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">{file.name}</span>
        <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
        <button
          type="button"
          onClick={() => onFile(null)}
          aria-label="Remove file"
          className="focus-ring rounded-full p-1 text-slate-400 hover:text-[var(--ink)]"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <label
      id={id}
      tabIndex={-1}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        pick(e.dataTransfer.files?.[0])
      }}
      className={clsx(
        'mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-4 text-center text-sm transition-colors',
        over ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-black/10 text-slate-500 hover:border-black/25',
        highlighted && 'ring-2 ring-[var(--accent)]',
      )}
    >
      <Upload size={16} className="shrink-0" />
      <span>
        Add Proforma document (optional) or <span className="font-semibold text-[var(--ink)] underline underline-offset-2">browse</span>
      </span>
      <input
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </label>
  )
}
