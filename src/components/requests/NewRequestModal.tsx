import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { format } from 'date-fns'
import { ArrowRight, Building2, CalendarDays, FileText, Info, Package, Pencil, Plus, ReceiptText, RotateCcw, Trash2, Upload, X } from 'lucide-react'
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
import type { Project } from '@/types'

interface ItemRow {
  name: string
  quantity: string
  unit: string
  unit_price: string
  description: string
}

const EMPTY_ITEM: ItemRow = { name: '', quantity: '1', unit: 'unit', unit_price: '', description: '' }
const UNITS = [
  'unit', 'each', 'pcs', 'pair', 'pack', 'set', 'box', 'bag', 'sack', 'bucket', 'drum',
  'm', 'cm', 'mm', 'm²', 'm³', 'ft', 'roll', 'sheet', 'board', 'length', 'bundle', 'pallet', 'load',
  'brick', 'block', 'tile', 'kg', 'g', 'ton', 'litre', 'mL',
  'hour', 'day', 'week', 'month', 'year', 'service', 'lot', 'license', 'seat',
]

const STEPS: Step[] = [
  { title: 'Details', hint: 'What you need and for which project' },
  { title: 'Items', hint: 'Line items and quantities' },
  { title: 'Cost & timing', hint: 'Estimate, due date and why' },
  { title: 'Vendor & Proforma', hint: 'Vendor details and optional Proforma document' },
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
  // Until the user types an amount, the estimate follows the items total
  const [amountOverridden, setAmountOverridden] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    project_id: '',
    vendor_name: '',
    vendor_location: '',
    proforma_amount: '',
    estimated_amount: '',
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
      const savedTotal = savedItems.reduce((sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price ?? 0), 0)
      setForm({
        title: r.title,
        description: r.description ?? '',
        project_id: r.project_id,
        vendor_name: r.vendor_name ?? r.quotations?.[0]?.vendor?.name ?? '',
        vendor_location: r.vendor_location ?? r.quotations?.[0]?.vendor?.address ?? '',
        proforma_amount: String(r.proforma_amount ?? r.quotations?.[0]?.amount ?? ''),
        estimated_amount: String(r.estimated_amount ?? ''),
        justification: r.justification ?? '',
        required_date: r.required_date ?? '',
      })
      setItems(
        savedItems.length
          ? savedItems.map((i) => ({
              name: i.name,
              quantity: String(i.quantity),
              unit: i.unit,
              unit_price: i.estimated_unit_price != null ? String(i.estimated_unit_price) : '',
              description: i.description ?? '',
            }))
          : [{ ...EMPTY_ITEM }],
      )
      setAmountOverridden(Math.abs(savedTotal - Number(r.estimated_amount)) > 0.005)
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

  const filledItems = items.filter(itemStarted)
  const itemsTotal = filledItems.reduce((sum, r) => sum + lineTotal(r), 0)
  const followsItems = !amountOverridden && itemsTotal > 0
  const estimate = followsItems ? itemsTotal : Number(form.estimated_amount)
  const hasVendorDetails = !!(
    form.vendor_name.trim() &&
    form.vendor_location.trim() &&
    Number(form.proforma_amount) > 0
  )

  const badItem = filledItems.find((r) => !r.name.trim() || !(Number(r.quantity) > 0) || (r.unit_price !== '' && Number(r.unit_price) < 0))
  const projectError = loadingProjects
    ? 'Projects are still loading. Please wait a moment.'
    : projectLoadFailed
      ? 'Could not load projects. Try again.'
      : projects.length === 0
        ? 'No active projects are available. Ask an admin to add or activate one before creating a purchase request.'
        : 'Choose which project this purchase is for'

  const stepErrors: Record<number, string | null> = {
    0: !form.title.trim() ? 'Add a short title for this request' : !form.project_id ? projectError : null,
    1: badItem ? 'Each item needs a name and a quantity' : null,
    2: !(estimate > 0) ? 'Enter an estimated amount to continue' : null,
    3: null,
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
      notify.warning('Enter the vendor name, location, and a Proforma amount greater than zero')
      return
    }
    setBusy(true)

    const input: RequestInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      project_id: form.project_id,
      vendor_name: form.vendor_name.trim(),
      vendor_location: form.vendor_location.trim(),
      proforma_amount: form.proforma_amount ? Number(form.proforma_amount) : null,
      estimated_amount: estimate,
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
        name: r.name.trim(),
        quantity: Number(r.quantity),
        unit: r.unit.trim() || 'unit',
        estimated_unit_price: r.unit_price === '' ? null : Number(r.unit_price),
        description: r.description.trim() || null,
      })),
    )
    if (itemsError) notify.warning(`Line items were not saved: ${itemsError}`)

    if (proformaFile) {
      const { error } = await attachFile(requestId, proformaFile, 'proforma', 'Vendor Proforma')
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
      notify.success(editing ? 'Draft changes saved' : 'Draft saved, complete the vendor details before submitting')
    }

    setBusy(false)
    announcePurchaseSaved(requestId)
    navigate(`/requests/${requestId}`)
  }

  const project = projects.find((p) => p.id === form.project_id)
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
              {project?.name ?? 'No project yet'}
              {filledItems.length > 0 && ` · ${filledItems.length} item${filledItems.length === 1 ? '' : 's'}`}
            </span>
            <span className="text-xl font-bold text-white">{money(estimate)}</span>
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

          <Field label="Project" error={err(0, !form.project_id)}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {projects.map((p) => {
                const active = form.project_id === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update('project_id', p.id)}
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
                      <Building2 size={17} />
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
            List what you are buying. Prices are estimates; the total becomes your estimated amount.
          </p>
          <datalist id="item-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="space-y-3">
            {items.map((r, i) => {
              const invalid = showErrors && step === 1 && itemStarted(r) && (!r.name.trim() || !(Number(r.quantity) > 0))
              return (
                <div key={i} className={clsx('rounded-[1.5rem] border p-4', invalid ? 'border-[var(--accent)]' : 'border-black/10')}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                      <Package size={15} className="text-slate-400" />
                      Item {i + 1}
                    </span>
                    <span className="flex items-center gap-2">
                      {lineTotal(r) > 0 && <span className="text-sm font-bold text-[var(--ink)]">{money(lineTotal(r))}</span>}
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTouched(true)
                            setItems((rows) => rows.filter((_, idx) => idx !== i))
                          }}
                          aria-label={`Remove item ${i + 1}`}
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
                    aria-label={`Item ${i + 1} name`}
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
                      aria-label={`Item ${i + 1} quantity`}
                      className={clsx(inputClass, 'border-transparent')}
                    />
                    <input
                      list="item-units"
                      value={r.unit}
                      onChange={(e) => updateItem(i, { unit: e.target.value })}
                      placeholder="Unit"
                      aria-label={`Item ${i + 1} unit`}
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
                      aria-label={`Item ${i + 1} estimated unit price`}
                      className={clsx(inputClass, 'border-transparent')}
                    />
                  </div>
                  <input
                    value={r.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder="Specs or notes (optional)"
                    aria-label={`Item ${i + 1} description`}
                    className={clsx(inputClass, 'mt-2 border-transparent')}
                  />
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setItems((rows) => [...rows, { ...EMPTY_ITEM }])}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-black/10 py-4 text-sm font-medium text-[var(--ink)] transition-colors hover:border-black/30"
          >
            <Plus size={16} />
            Add another item
          </button>
          <div className="flex items-center justify-between rounded-[1.5rem] bg-[var(--canvas)] px-5 py-4">
            <span className="text-sm text-[var(--ink-soft)]">
              {filledItems.length} item{filledItems.length === 1 ? '' : 's'} · estimated total
            </span>
            <span className="text-2xl font-black tracking-tight text-[var(--ink)]">{money(itemsTotal)}</span>
          </div>
        </>
      )}

      {!loadingEdit && step === 2 && (
        <>
          <Field label="Estimated amount (ETB)" error={err(2, !(estimate > 0))}>
            <div
              className={clsx(
                'flex items-center gap-2 rounded-[1.5rem] border bg-[var(--canvas)] px-5 py-4 transition-colors focus-within:border-[var(--ink)] focus-within:bg-white',
                err(2, !(estimate > 0)) ? 'border-[var(--accent)]' : 'border-transparent',
              )}
            >
              <span className="text-xl font-black text-slate-300">ETB</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={followsItems ? String(Math.round(itemsTotal * 100) / 100) : form.estimated_amount}
                onChange={(e) => {
                  setAmountOverridden(true)
                  update('estimated_amount', e.target.value)
                }}
                placeholder="0"
                className="w-full min-w-0 bg-transparent text-4xl font-black tracking-tight text-[var(--ink)] outline-none placeholder:text-slate-300 sm:text-5xl"
              />
            </div>
            {itemsTotal > 0 && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{followsItems ? 'Matches your items total.' : `Items total is ${money(itemsTotal)}.`}</span>
                {!followsItems && (
                  <button
                    type="button"
                    onClick={() => {
                      setAmountOverridden(false)
                      update('estimated_amount', '')
                    }}
                    className="focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold text-[var(--ink)] hover:bg-[var(--canvas)]"
                  >
                    <RotateCcw size={12} />
                    Use items total
                  </button>
                )}
              </div>
            )}
          </Field>

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
            <Field label="Vendor name">
              <input
                value={form.vendor_name}
                onChange={(e) => update('vendor_name', e.target.value)}
                placeholder="Supplier or company name"
                className={clsx(inputClass, 'border-transparent')}
              />
            </Field>
            <Field label="Vendor location">
              <input
                value={form.vendor_location}
                onChange={(e) => update('vendor_location', e.target.value)}
                placeholder="City, site, or address"
                className={clsx(inputClass, 'border-transparent')}
              />
            </Field>
          </div>
          <Field label="Proforma amount (ETB)">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.proforma_amount}
              onChange={(e) => update('proforma_amount', e.target.value)}
              placeholder="Amount shown on the Proforma"
              className={clsx(inputClass, 'border-transparent')}
            />
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
                <p className="text-xs text-slate-500">{project?.name}</p>
                <p className="mt-1 text-xl font-bold text-[var(--ink)]">{form.title}</p>
                {form.description && <p className="mt-1 text-sm text-[var(--ink-soft)]">{form.description}</p>}
              </div>
              <p className="text-4xl font-black tracking-tight text-[var(--ink)]">{money(estimate)}</p>
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
              label="Vendor / Proforma"
              value={hasVendorDetails ? `${form.vendor_name} · ${money(form.proforma_amount)}` : 'Incomplete'}
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
                Add the vendor name, location, and Proforma amount to submit. The document is optional.{' '}
                <button type="button" onClick={() => setStep(3)} className="font-semibold underline underline-offset-2">
                  Complete vendor details
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
