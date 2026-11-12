import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { format } from 'date-fns'
import { ArrowRight, Building2, CalendarDays, Check, FileText, Info, Package, Pencil, Plus, ReceiptText, Trash2, Upload, X } from 'lucide-react'
import { notify } from '@/lib/notify'
import { ACCEPT_ATTR, attachFile, formatBytes, validateFile } from '@/lib/storage'
import { EDITABLE_STATUSES, submitRequest } from '@/lib/workflow'
import { useAuth } from '@/context/AuthContext'
import { formatCurrency } from '@/utils'
import { ReviewTile, StepField as Field, StepModal, type Step } from '@/components/ui/StepModal'
import {
  announcePurchaseSaved,
  createPurchaseRequest,
  fetchProjects,
  fetchPurchaseRequestById,
  replaceItems,
  updatePurchaseRequest,
  type RequestInput,
} from '@/services/requests'
import { PAYMENT_METHOD_LABELS, type Project, type SupplierPaymentMethod } from '@/types'

interface ItemRow {
  /** Which selected project the line is for; empty means the first selected project */
  project_id: string
  name: string
  quantity: string
  unit: string
  unit_price: string
  description: string
}

const EMPTY_ITEM: ItemRow = { project_id: '', name: '', quantity: '1', unit: 'unit', unit_price: '', description: '' }
const UNITS = [
  'unit', 'each', 'pcs', 'pair', 'pack', 'set', 'box', 'bag', 'sack', 'bucket', 'drum',
  'm', 'cm', 'mm', 'm²', 'm³', 'ft', 'roll', 'sheet', 'board', 'length', 'bundle', 'pallet', 'load',
  'brick', 'block', 'tile', 'kg', 'g', 'ton', 'litre', 'mL',
  'hour', 'day', 'week', 'month', 'year', 'service', 'lot', 'license', 'seat',
]

const STEPS: Step[] = [
  { title: 'Details', hint: 'What you need and for which projects' },
  { title: 'Items', hint: 'Items, quantities and unit prices' },
  { title: 'Total & timing', hint: 'Total from your items, due date and why' },
  { title: 'Supplier & Proforma', hint: 'One supplier, payment details and optional Proforma' },
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
  const [touched, setTouched] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }])
  const [proformaFile, setProformaFile] = useState<File | null>(null)
  const [existingProforma, setExistingProforma] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    /** Selected projects in the order picked; the first is the primary project */
    project_ids: [] as string[],
    vendor_name: '',
    vendor_location: '',
    supplier_payment_method: '' as SupplierPaymentMethod | '',
    supplier_bank_name: '',
    supplier_account_number: '',
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
      setForm({
        title: r.title,
        description: r.description ?? '',
        project_ids: r.project_ids?.length ? r.project_ids : [r.project_id],
        vendor_name: r.vendor_name ?? r.quotations?.[0]?.vendor?.name ?? '',
        vendor_location: r.vendor_location ?? r.quotations?.[0]?.vendor?.address ?? '',
        supplier_payment_method: r.supplier_payment_method ?? '',
        supplier_bank_name: r.supplier_bank_name ?? '',
        supplier_account_number: r.supplier_account_number ?? '',
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
      setExistingProforma(r.attachments?.find((a) => a.attachment_type === 'proforma')?.file_name ?? null)
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

  function toggleProject(id: string) {
    setTouched(true)
    setForm((f) => ({
      ...f,
      project_ids: f.project_ids.includes(id) ? f.project_ids.filter((p) => p !== id) : [...f.project_ids, id],
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
  const hasVendorDetails = !!(form.vendor_name.trim() && form.vendor_location.trim())

  const accountDigits = form.supplier_account_number.replace(/\D/g, '')
  const paymentError =
    form.supplier_account_number.trim() && !/^[\d\s+-]+$/.test(form.supplier_account_number.trim())
      ? 'Use digits only for the account or Telebirr number'
      : form.supplier_payment_method === 'telebirr' && accountDigits && (accountDigits.length < 9 || accountDigits.length > 12)
        ? 'Enter a valid Telebirr phone number, e.g. 0912345678'
        : null

  const badItem = filledItems.find((r) => !r.name.trim() || !(Number(r.quantity) > 0) || !(Number(r.unit_price) > 0))
  const projectError = loadingProjects
    ? 'Projects are still loading. Please wait a moment.'
    : projectLoadFailed
      ? 'Could not load projects. Try again.'
      : projects.length === 0
        ? 'No active projects are available. Ask an admin to add or activate one before creating a purchase request.'
        : 'Choose which project this purchase is for'

  const stepErrors: Record<number, string | null> = {
    0: !form.title.trim() ? 'Add a short title for this request' : !form.project_ids.length ? projectError : null,
    1: !filledItems.length
      ? 'Add at least one item'
      : badItem
        ? 'Each item needs a name, a quantity and a unit price'
        : emptyProject
          ? `Add at least one item for ${emptyProject.name}, or remove that project`
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

  async function save(submitAfter: boolean) {
    // Success navigates to the request, which closes this modal
    if (!profile || loadingEdit) return
    const firstInvalid = Object.keys(stepErrors).map(Number).find((s) => stepErrors[s])
    if (firstInvalid !== undefined) {
      goTo(firstInvalid + 1)
      notify.warning(stepErrors[firstInvalid]!)
      return
    }
    if (submitAfter && !hasVendorDetails) {
      setShowErrors(true)
      setStep(3)
      notify.warning('Enter the supplier name and location')
      return
    }
    setBusy(true)

    const input: RequestInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      project_id: form.project_ids[0],
      project_ids: form.project_ids,
      vendor_name: form.vendor_name.trim(),
      vendor_location: form.vendor_location.trim(),
      supplier_payment_method: form.supplier_account_number.trim() ? form.supplier_payment_method : '',
      supplier_bank_name: form.supplier_payment_method === 'bank' ? form.supplier_bank_name.trim() : '',
      supplier_account_number: form.supplier_payment_method ? form.supplier_account_number.trim() : '',
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
    if (itemsError) notify.warning(`Line items were not saved: ${itemsError}`)

    if (proformaFile) {
      const { error } = await attachFile(requestId, proformaFile, 'proforma', 'Supplier Proforma')
      if (error) {
        setBusy(false)
        notify.error(`Request saved, but the Proforma could not be uploaded: ${error}`)
        return
      }
      setExistingProforma(proformaFile.name)
      setProformaFile(null)
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
      submitDisabled={!hasVendorDetails}
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
          <Field label="Title" error={err(0, !form.title.trim())}>
            <input
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Structural steel beams"
              className={clsx(inputClass, 'text-base', err(0, !form.title.trim()) ? 'border-[var(--accent)]' : 'border-transparent')}
            />
          </Field>

          <Field label="Projects" error={err(0, !form.project_ids.length)}>
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
                        {p.code}
                        {p.client_name ? ` · ${p.client_name}` : ''}
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

          <div className="grid grid-cols-1 gap-5">
            <Field label="Description" optional>
              <textarea
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={3}
                placeholder="What is this purchase for?"
                className={clsx(inputClass, 'resize-none border-transparent')}
              />
            </Field>
          </div>
        </>
      )}

      {!loadingEdit && step === 1 && (
        <>
          <p className="text-sm text-[var(--ink-soft)]">
            List what you are buying with a unit price for each. The total is calculated for you.
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
                          Item {n + 1}
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
                              aria-label={`Remove item ${n + 1}${group ? ` for ${group.name}` : ''}`}
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
                        placeholder="Item name, e.g. HEB 200 steel beam"
                        aria-label={`Item ${n + 1} name`}
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
                          placeholder="Qty"
                          aria-label={`Item ${n + 1} quantity`}
                          className={clsx(inputClass, 'border-transparent')}
                        />
                        <input
                          list="item-units"
                          value={r.unit}
                          onChange={(e) => updateItem(i, { unit: e.target.value })}
                          placeholder="Unit"
                          aria-label={`Item ${n + 1} unit`}
                          className={clsx(inputClass, 'border-transparent')}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={r.unit_price}
                          onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                          placeholder="Unit price ETB"
                          aria-label={`Item ${n + 1} unit price`}
                          className={clsx(inputClass, invalid && !(Number(r.unit_price) > 0) ? 'border-[var(--accent)]' : 'border-transparent')}
                        />
                      </div>
                      <input
                        value={r.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        placeholder="Specs or notes (optional)"
                        aria-label={`Item ${n + 1} description`}
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
                  {group ? `Add item for ${group.name}` : 'Add another item'}
                </button>
              </section>
            )
          })}
          <div className="flex items-center justify-between rounded-[1.5rem] bg-[var(--ink)] px-5 py-4 text-white">
            <span className="text-sm text-white/70">
              {filledItems.length} item{filledItems.length === 1 ? '' : 's'} · total
            </span>
            <span className="text-2xl font-black tracking-tight">{money(itemsTotal)}</span>
          </div>
        </>
      )}

      {!loadingEdit && step === 2 && (
        <>
          <div className="rounded-[1.5rem] bg-[var(--canvas)] px-5 py-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total (from your items)</p>
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
              Change items or prices
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

          <Field label="Justification" optional>
            <textarea
              value={form.justification}
              onChange={(e) => update('justification', e.target.value)}
              rows={4}
              placeholder="Why is this needed? Reviewers will use this to assess the request."
              className={clsx(inputClass, 'resize-none border-transparent')}
            />
          </Field>
        </>
      )}

      {!loadingEdit && step === 3 && (
        <>
          <p className="text-sm text-[var(--ink-soft)]">
            Enter the supplier details and Proforma amount. Attaching the Proforma document is optional.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Supplier name">
              <input
                value={form.vendor_name}
                onChange={(e) => update('vendor_name', e.target.value)}
                placeholder="Supplier or company name"
                className={clsx(inputClass, 'border-transparent')}
              />
            </Field>
            <Field label="Supplier location">
              <input
                value={form.vendor_location}
                onChange={(e) => update('vendor_location', e.target.value)}
                placeholder="City, site, or address"
                className={clsx(inputClass, 'border-transparent')}
              />
            </Field>
          </div>
          <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink-soft)]">
            Proforma amount: <span className="font-semibold text-[var(--ink)]">{money(itemsTotal)}</span>, the total of your items.
          </p>
          <Field label="Payment details for Finance" optional>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
              {(Object.keys(PAYMENT_METHOD_LABELS) as SupplierPaymentMethod[]).map((method) => {
                const active = form.supplier_payment_method === method
                return (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update('supplier_payment_method', active ? '' : method)}
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
            {form.supplier_payment_method && (
              <div className={clsx('mt-2 grid grid-cols-1 gap-2', form.supplier_payment_method === 'bank' && 'sm:grid-cols-2')}>
                {form.supplier_payment_method === 'bank' && (
                  <input
                    value={form.supplier_bank_name}
                    onChange={(e) => update('supplier_bank_name', e.target.value)}
                    placeholder="Bank name, e.g. CBE"
                    aria-label="Bank name"
                    className={clsx(inputClass, 'border-transparent')}
                  />
                )}
                <input
                  value={form.supplier_account_number}
                  onChange={(e) => update('supplier_account_number', e.target.value)}
                  inputMode="numeric"
                  placeholder={form.supplier_payment_method === 'bank' ? 'Account number' : 'Telebirr phone number, e.g. 0912345678'}
                  aria-label={form.supplier_payment_method === 'bank' ? 'Account number' : 'Telebirr number'}
                  className={clsx(inputClass, err(3, !!paymentError) ? 'border-[var(--accent)]' : 'border-transparent')}
                />
              </div>
            )}
            {err(3, !!paymentError) && <p className="mt-2 text-xs font-medium text-[var(--accent)]">{paymentError}</p>}
            <p className="mt-2 text-xs text-slate-500">Only Finance and Admin can see these details. Finance uses them to transfer the payment.</p>
          </Field>
          {existingProforma && !proformaFile && (
            <p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm text-[var(--ink-soft)]">
              Attached Proforma: <span className="font-semibold text-[var(--ink)]">{existingProforma}</span>
            </p>
          )}
          <DropZone file={proformaFile} onFile={(file) => {
            setTouched(true)
            setProformaFile(file)
          }} />
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
              label="Items"
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
                form.supplier_payment_method && form.supplier_account_number.trim()
                  ? `${PAYMENT_METHOD_LABELS[form.supplier_payment_method]} · ${form.supplier_account_number.trim()}`
                  : 'Not provided'
              }
              onEdit={() => setStep(3)}
            />
            <ReviewTile
              label="Supplier / Proforma"
              value={hasVendorDetails ? `${form.vendor_name} · ${money(itemsTotal)}` : 'Incomplete'}
              onEdit={() => setStep(3)}
            />
          </div>

          {filledItems.length > 0 && (
            <div className="rounded-[1.5rem] border border-black/10 p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Items</p>
              <ul className="mt-2 divide-y divide-black/[0.05]">
                {filledItems.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-[var(--ink)]">
                      {r.name}
                      <span className="text-slate-500">
                        {' '}· {r.quantity} {r.unit}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-[var(--ink)]">{money(lineTotal(r))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {form.justification && (
            <div className="rounded-[1.5rem] border border-black/10 p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Justification</p>
              <p className="mt-2 text-sm text-[var(--ink)]">{form.justification}</p>
            </div>
          )}

          {!hasVendorDetails ? (
            <div className="flex items-center gap-3 rounded-[1.5rem] bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--accent)]">
                <Info size={16} />
              </span>
              <span>
                Add the supplier name and location to submit. The Proforma document is optional.{' '}
                <button type="button" onClick={() => setStep(3)} className="font-semibold underline underline-offset-2">
                  Complete supplier details
                </button>{' '}
                or save this as a draft for now.
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
                {!proformaFile && !existingProforma && ' You can submit without the Proforma document.'}
              </span>
            </div>
          )}
        </>
      )}
    </StepModal>
  )
}

function DropZone({ file, onFile }: { file: File | null; onFile: (file: File | null) => void }) {
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
