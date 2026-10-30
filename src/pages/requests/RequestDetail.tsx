import { useEffect, useState, type ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { format } from 'date-fns'
import { Check, Clock, CornerUpLeft, FileText, Paperclip, Pencil, Plus, RotateCcw, Send, ShieldCheck, Trash2, Upload, X as XIcon } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { Avatar, Breadcrumbs, Button, StatusBadge, useConfirm } from '@/components/ui'
import {
  approveStage,
  completeRequest,
  EDITABLE_STATUSES,
  recordPurchase,
  rejectRequest,
  returnToRequester,
  ROLE_STAGE,
  STAGE_LABELS,
  stageForStatus,
  submitRequest,
} from '@/lib/workflow'
import { ACCEPT_ATTR, attachFile, formatBytes, openAttachment, validateFile } from '@/lib/storage'
import {
  addQuotation,
  deletePurchaseRequest,
  fetchActiveVendors,
  fetchPurchaseRequestById,
  PURCHASE_SAVED_EVENT,
  selectQuotation,
} from '@/services/requests'
import { ATTACHMENT_TYPE_LABELS, ROLE_LABELS, type AttachmentType, type PurchaseAttachment, type PurchaseRequest, type Vendor } from '@/types'
import { formatCurrency } from '@/utils'

const EMPTY_QUOTE = { vendor_id: '', amount: '', valid_until: '', notes: '' }

export function RequestDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [loading, setLoading] = useState(true)
  // Which action is running, so only that button spins
  const [busy, setBusy] = useState<string | null>(null)
  const [approvedAmount, setApprovedAmount] = useState<string | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<AttachmentType>('other')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [quoteFormOpen, setQuoteFormOpen] = useState(false)
  const [quoteForm, setQuoteForm] = useState(EMPTY_QUOTE)
  const [quoteFile, setQuoteFile] = useState<File | null>(null)
  const [quoteBusy, setQuoteBusy] = useState(false)

  async function load() {
    setRequest(id ? await fetchPurchaseRequestById(id) : null)
    setLoading(false)
  }

  useEffect(() => {
    setApprovedAmount(null)
    load()
    // The edit modal lives in the layout; reload when it saves this request
    function onSaved(e: Event) {
      if ((e as CustomEvent<{ id: string }>).detail?.id === id) load()
    }
    window.addEventListener(PURCHASE_SAVED_EVENT, onSaved)
    return () => window.removeEventListener(PURCHASE_SAVED_EVENT, onSaved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="py-16 text-center text-sm text-slate-500">Loading request…</p>
  if (!request)
    return (
      <div className="rounded-[1.75rem] bg-white px-6 py-16 text-center">
        <p className="text-2xl font-black text-[var(--ink)]">Request not found</p>
        <Link to="/requests" className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-4">
          Back to requests
        </Link>
      </div>
    )

  const req = request
  const role = profile?.role
  const isRequester = !!profile && profile.id === req.requester_id
  const myStage = role ? ROLE_STAGE[role] : null
  const currentStage = stageForStatus(req.status)
  const myTurn = !!myStage && currentStage === myStage
  // The server blocks self-approval too; hide the panel instead of letting it fail
  const canAct = myTurn && !isRequester
  const editable = isRequester && EDITABLE_STATUSES.includes(req.status)
  const financeOrAdmin = role === 'finance' || role === 'admin'
  const canPurchase = financeOrAdmin || role === 'owner'
  const canComplete = canPurchase || isRequester
  // Mirrors the API's quotation rules (POST /purchase-requests/{id}/quotations/)
  const canAddQuote =
    (isRequester && ['draft', 'quote_received', 'awaiting_finance'].includes(req.status)) ||
    (financeOrAdmin && !['purchased', 'completed', 'rejected'].includes(req.status))
  const canSelectQuote = financeOrAdmin && !['purchased', 'completed', 'rejected'].includes(req.status)
  const canSetAmount = role === 'finance' || role === 'owner'

  const quotes = [...(req.quotations ?? [])].sort((a, b) => Number(a.amount) - Number(b.amount))
  const lowest = quotes.length ? Number(quotes[0].amount) : null
  const selectedQuote = quotes.find((q) => q.is_selected)
  const items = req.items ?? []
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price ?? 0), 0)
  const defaultApproved = Number(selectedQuote?.amount ?? req.approved_amount ?? req.estimated_amount)
  const approvedInput = approvedAmount ?? String(defaultApproved)
  const nextStep = currentStage === 'finance' ? 'the General Manager' : currentStage === 'gm' ? 'the Owner' : 'purchasing'

  // Hero shows the latest known figure large, the others underneath
  const amounts = [
    { label: 'Estimated', value: req.estimated_amount },
    { label: 'Approved', value: req.approved_amount },
    { label: 'Paid', value: req.actual_amount },
  ].filter((a) => a.value != null)
  const headline = amounts[amounts.length - 1]

  function pickFile(setter: (f: File | null) => void) {
    return (file: File | null) => {
      const problem = file ? validateFile(file) : null
      if (problem) {
        notify.warning(problem)
        return
      }
      setter(file)
    }
  }

  async function run(key: string, action: () => Promise<{ error: string | null }>, success: string, failure: string) {
    setBusy(key)
    const { error } = await action()
    setBusy(null)
    if (error) {
      notify.error(`${failure}: ${error}`)
      return false
    }
    notify.success(success)
    load()
    return true
  }

  async function handleSubmit() {
    const ok = await confirm({
      title: 'Submit for Finance review?',
      body: 'You will not be able to edit it while it is being reviewed.',
      confirmLabel: 'Submit request',
      tone: 'accent',
      icon: Send,
    })
    if (ok) await run('submit', () => submitRequest(req.id), 'Request submitted for Finance review', 'Could not submit this request')
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this draft?',
      body: `${req.request_number} and its items and quotes will be removed for good.`,
      confirmLabel: 'Delete draft',
      tone: 'danger',
      icon: Trash2,
    })
    if (!ok) return
    setBusy('delete')
    const { error } = await deletePurchaseRequest(req.id)
    setBusy(null)
    if (error) notify.error(`Could not delete this draft: ${error}`)
    else {
      notify.success('Draft deleted')
      navigate('/requests')
    }
  }

  async function handleApprove() {
    const amount = canSetAmount ? Number(approvedInput) : null
    if (canSetAmount && !(amount! > 0)) {
      notify.warning('Enter an approved amount above zero')
      return
    }
    const comment = await confirm({
      title: 'Approve this request?',
      body: (
        <>
          {canSetAmount && (
            <>
              Approving <strong className="font-semibold text-[var(--ink)]">{formatCurrency(amount)}</strong>.{' '}
            </>
          )}
          It moves on to {nextStep}.
        </>
      ),
      confirmLabel: 'Approve',
      tone: 'accent',
      input: { label: 'Comment', placeholder: 'Anything the next reviewer should know', required: false },
    })
    if (comment === null) return
    await run('approve', () => approveStage(req.id, comment, amount), 'Approved and moved to the next stage', 'Could not approve this request')
  }

  async function handleReject() {
    const reason = await confirm({
      title: 'Reject this request?',
      body: 'This ends the request. The requester will see your reason.',
      confirmLabel: 'Reject request',
      tone: 'danger',
      input: { label: 'Reason', placeholder: 'Why is this rejected?', required: true },
    })
    if (reason === null) return
    await run('reject', () => rejectRequest(req.id, reason), 'Request rejected and the reason was saved', 'Could not reject this request')
  }

  async function handleReturn() {
    const note = await confirm({
      title: 'Send back for changes?',
      body: 'The requester can edit and resubmit. Approvals start over from Finance.',
      confirmLabel: 'Send back',
      tone: 'ink',
      icon: CornerUpLeft,
      input: { label: 'What needs to change?', placeholder: 'e.g. Add a second vendor quote', required: true },
    })
    if (note === null) return
    setBusy('return')
    const { error } = await returnToRequester(req.id, note)
    setBusy(null)
    if (error) {
      notify.error(`Could not send this request back: ${error}`)
      return
    }
    notify.success('Sent back to the requester for changes')
    // quote_received is only visible to the requester; leave the detail page
    // so Finance/GM/Owner do not land on "Request not found".
    navigate('/requests')
  }

  async function handleRecordPurchase() {
    if (!profile) return
    const amount = Number(purchaseAmount)
    if (!amount || amount <= 0) {
      notify.warning('Enter the actual amount paid to continue')
      return
    }
    const ok = await confirm({
      title: 'Record this purchase?',
      body: (
        <>
          <strong className="font-semibold text-[var(--ink)]">{formatCurrency(amount)}</strong> paid
          {req.approved_amount != null && <> against {formatCurrency(req.approved_amount)} approved</>}. The request is marked as purchased.
        </>
      ),
      confirmLabel: 'Record purchase',
      tone: 'ink',
    })
    if (!ok) return
    setBusy('purchase')
    const { error } = await recordPurchase(req.id, amount)
    if (error) {
      setBusy(null)
      notify.error(`Could not record the purchase: ${error}`)
      return
    }
    if (receiptFile) {
      const { error: fileError } = await attachFile(req.id, receiptFile, 'receipt', 'Proof of purchase')
      if (fileError) notify.warning(`Purchase saved, but the receipt upload failed: ${fileError}`)
    }
    setBusy(null)
    notify.success('Purchase recorded and request marked as purchased')
    setReceiptFile(null)
    setPurchaseAmount('')
    load()
  }

  async function handleComplete() {
    const ok = await confirm({
      title: 'Mark as completed?',
      body: 'Confirm everything was delivered. This closes the request.',
      confirmLabel: 'Mark completed',
      tone: 'accent',
    })
    if (ok) await run('complete', () => completeRequest(req.id), 'Request marked as completed, all done here', 'Could not complete this request')
  }

  async function handleUploadDocument() {
    if (!profile || !uploadFile) {
      notify.warning('Choose a file before uploading a document')
      return
    }
    setUploadBusy(true)
    const { error } = await attachFile(req.id, uploadFile, uploadType)
    setUploadBusy(false)
    if (error) notify.error(`Could not upload the document: ${error}`)
    else {
      notify.success('Document uploaded and attached to this request')
      setUploadFile(null)
      load()
    }
  }

  async function handleOpenDocument(a: PurchaseAttachment) {
    const { error } = await openAttachment(a)
    if (error) notify.error(`Could not open this file: ${error}`)
  }

  function openQuoteForm() {
    setQuoteFormOpen(true)
    if (vendors.length === 0) fetchActiveVendors().then(setVendors)
  }

  async function handleAddQuote() {
    if (!profile) return
    if (!quoteForm.vendor_id || !(Number(quoteForm.amount) > 0)) {
      notify.warning('Choose a vendor and enter the quoted amount')
      return
    }
    setQuoteBusy(true)
    const { error, fileError } = await addQuotation(req.id, {
      vendor_id: quoteForm.vendor_id,
      amount: Number(quoteForm.amount),
      valid_until: quoteForm.valid_until || null,
      notes: quoteForm.notes.trim() || null,
      file: quoteFile,
    })
    setQuoteBusy(false)
    if (error) {
      notify.error(`Could not add the quotation: ${error}`)
      return
    }
    if (fileError) notify.warning(`Quote saved, but the file upload failed: ${fileError}`)
    else notify.success('Quotation added to this request')
    setQuoteForm(EMPTY_QUOTE)
    setQuoteFile(null)
    setQuoteFormOpen(false)
    load()
  }

  async function handleSelectQuote(quoteId: string) {
    setBusy(`select-${quoteId}`)
    const { error } = await selectQuotation(req.id, quoteId)
    setBusy(null)
    if (error) notify.error(`Could not select this quote: ${error}`)
    else {
      notify.success('Quote marked as the selected vendor')
      setApprovedAmount(null)
      load()
    }
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          { label: 'Overview', to: '/dashboard' },
          { label: 'Purchase requests', to: '/requests' },
          { label: req.request_number },
        ]}
      />

      {/* ── Hero ── */}
      <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white">{req.request_number}</span>
          <StatusBadge status={req.status} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] font-black tracking-[-0.035em] break-words text-[var(--ink)]">{req.title}</h1>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {req.project?.name} · {req.department}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{headline.label}</p>
            <p className="text-[clamp(2.2rem,5vw,3.5rem)] leading-none font-black tracking-tight text-[var(--ink)]">{formatCurrency(headline.value)}</p>
            {amounts.length > 1 && (
              <p className="mt-1 text-xs text-slate-500">
                {amounts
                  .slice(0, -1)
                  .map((a) => `${a.label} ${formatCurrency(a.value)}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-6 md:grid-cols-4">
          <Meta label="Requester">
            <span className="flex items-center gap-2">
              {req.requester && <Avatar initials={req.requester.avatar_initials} size={26} />}
              <span className="truncate">{req.requester?.full_name}</span>
            </span>
          </Meta>
          <Meta label="Role">{req.requester ? ROLE_LABELS[req.requester.role] : '—'}</Meta>
          <Meta label="Needed by">{req.required_date ? format(new Date(`${req.required_date}T00:00`), 'MMM d, yyyy') : 'Not set'}</Meta>
          <Meta label={req.submitted_at ? 'Submitted' : 'Created'}>{format(new Date(req.submitted_at ?? req.created_at), 'MMM d, yyyy')}</Meta>
        </div>

        {req.return_note && EDITABLE_STATUSES.includes(req.status) && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--sun-soft)] p-4 text-sm text-[var(--ink)]">
            <RotateCcw size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong className="font-semibold">Sent back for changes:</strong> {req.return_note}
            </p>
          </div>
        )}

        {req.rejection_reason && req.status === 'rejected' && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
            <XIcon size={18} className="mt-0.5 shrink-0 text-[var(--accent)]" />
            <p>
              <strong className="font-semibold">Rejected:</strong> {req.rejection_reason}
            </p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Main column ── */}
        <div className="order-2 min-w-0 space-y-4 lg:order-1">
          {(req.description || req.justification) && (
            <section className="grid grid-cols-1 gap-6 rounded-[1.75rem] bg-white p-6 sm:grid-cols-2 sm:p-8">
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Description</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{req.description || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Justification</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{req.justification || '—'}</p>
              </div>
            </section>
          )}

          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Items" count={items.length} />
            {items.length === 0 ? (
              <p className="text-sm text-slate-500">No line items listed.</p>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(0,1fr)_6rem_7rem_7rem] gap-3 px-4 pb-2 text-xs font-medium tracking-wide text-slate-500 uppercase sm:grid">
                  <span>Item</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Unit price (ETB)</span>
                  <span className="text-right">Total</span>
                </div>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const total = Number(item.quantity) * Number(item.estimated_unit_price ?? 0)
                    return (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl bg-[var(--canvas)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.name}</p>
                          {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
                          <p className="text-xs text-slate-500 sm:hidden">
                            {Number(item.quantity).toLocaleString()} {item.unit}
                            {item.estimated_unit_price != null && ` × ${formatCurrency(item.estimated_unit_price)}`}
                          </p>
                        </div>
                        <span className="hidden text-right text-sm text-[var(--ink-soft)] sm:block">
                          {Number(item.quantity).toLocaleString()} {item.unit}
                        </span>
                        <span className="hidden text-right text-sm text-[var(--ink-soft)] sm:block">
                          {item.estimated_unit_price != null ? formatCurrency(item.estimated_unit_price) : '—'}
                        </span>
                        <span className="text-right text-sm font-bold text-[var(--ink)]">{total > 0 ? formatCurrency(total) : '—'}</span>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] px-4 pt-3">
                  <span className="text-sm text-[var(--ink-soft)]">
                    Items total
                    {itemsTotal > 0 && Math.abs(itemsTotal - Number(req.estimated_amount)) > 0.005 && ` · estimate ${formatCurrency(req.estimated_amount)}`}
                  </span>
                  <span className="text-xl font-black tracking-tight text-[var(--ink)]">{formatCurrency(itemsTotal)}</span>
                </div>
              </>
            )}
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle
              title="Vendor quotations"
              count={quotes.length}
              action={
                canAddQuote &&
                !quoteFormOpen && (
                  <Button variant="outline" onClick={openQuoteForm} className="h-9 px-4">
                    <Plus size={15} />
                    Add quote
                  </Button>
                )
              }
            />
            {quotes.length === 0 ? (
              <p className="text-sm text-slate-500">No quotations attached.</p>
            ) : (
              <div className="space-y-2">
                {quotes.map((q) => {
                  const diff = lowest !== null ? Number(q.amount) - lowest : 0
                  const expired = !!q.valid_until && new Date(`${q.valid_until}T23:59`) < new Date()
                  return (
                    <div
                      key={q.id}
                      className={clsx(
                        'flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--canvas)] px-4 py-3.5',
                        q.is_selected && 'ring-2 ring-[var(--ink)]',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                          {q.vendor?.name}
                          {quotes.length > 1 && diff === 0 && <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 text-[11px]">Lowest</span>}
                          {q.is_selected && <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[11px] text-white">Selected</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {q.valid_until ? (
                            <span className={clsx(expired && 'font-semibold text-[var(--accent)]')}>
                              {expired ? 'Expired' : 'Valid until'} {format(new Date(`${q.valid_until}T00:00`), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            'No expiry set'
                          )}
                          {q.notes && ` · ${q.notes}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {canSelectQuote && !q.is_selected && (
                          <Button variant="ghost" onClick={() => handleSelectQuote(q.id)} loading={busy === `select-${q.id}`} className="h-9 px-3 text-xs">
                            Select
                          </Button>
                        )}
                        <div className="text-right">
                          <p className="text-lg leading-tight font-bold text-[var(--ink)]">{formatCurrency(q.amount)}</p>
                          {quotes.length > 1 && diff > 0 && (
                            <p className="text-[11px] text-slate-500">
                              +{formatCurrency(diff)} ({Math.round((diff / (lowest || 1)) * 100)}%)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {quoteFormOpen && (
              <div className="mt-4 space-y-2 border-t border-black/[0.06] pt-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
                  <select
                    value={quoteForm.vendor_id}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, vendor_id: e.target.value }))}
                    aria-label="Vendor"
                    className="field h-11 !py-0"
                  >
                    <option value="">{vendors.length ? 'Select vendor' : 'Loading vendors…'}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={quoteForm.amount}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="Amount ($)"
                    aria-label="Quoted amount"
                    className="field h-11 !py-0"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
                  <input
                    value={quoteForm.notes}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notes (optional)"
                    className="field h-11 !py-0"
                  />
                  <input
                    type="date"
                    value={quoteForm.valid_until}
                    onChange={(e) => setQuoteForm((f) => ({ ...f, valid_until: e.target.value }))}
                    aria-label="Valid until"
                    title="Valid until"
                    className="field h-11 !py-0"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <FilePick file={quoteFile} onFile={pickFile(setQuoteFile)} label="Attach quote file (optional)" />
                  <div className="flex gap-2">
                    <Button onClick={handleAddQuote} loading={quoteBusy} className="flex-1 sm:flex-none">
                      Save quote
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setQuoteFormOpen(false)
                        setQuoteForm(EMPTY_QUOTE)
                        setQuoteFile(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Documents" count={req.attachments?.length ?? 0} />
            <div className="space-y-2">
              {req.attachments && req.attachments.length > 0 ? (
                req.attachments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleOpenDocument(a)}
                    className="focus-ring group flex w-full items-center gap-3 rounded-2xl bg-[var(--canvas)] px-4 py-3 text-left transition-colors hover:bg-[#ebe7e2]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--accent)]">
                      <FileText size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">{a.file_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {ATTACHMENT_TYPE_LABELS[a.attachment_type]}
                        {a.file_size ? ` · ${formatBytes(a.file_size)}` : ''} · {a.uploaded_by_profile?.full_name ?? 'Unknown'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--ink)] opacity-0 transition-opacity group-hover:opacity-100">Open</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">No documents uploaded yet.</p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-black/[0.06] pt-4 sm:flex-row">
              <select value={uploadType} onChange={(e) => setUploadType(e.target.value as AttachmentType)} className="field h-11 !py-0 sm:w-44">
                {Object.entries(ATTACHMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <FilePick file={uploadFile} onFile={pickFile(setUploadFile)} />
              <Button variant="outline" onClick={handleUploadDocument} loading={uploadBusy}>
                <Upload size={16} />
                Upload
              </Button>
            </div>
          </section>
        </div>

        {/* ── Side column: actions first so approvers see them immediately ── */}
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          {editable && (
            <section className="panel-dark relative overflow-hidden rounded-[1.75rem] p-6">
              <div className="relative">
                <span className="rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                  {req.status === 'draft' ? 'Draft' : 'Quote received'}
                </span>
                <p className="mt-3 text-2xl leading-tight font-black text-white">Ready to submit?</p>
                <p className="mt-1 text-sm text-white/60">
                  {quotes.length === 0 ? 'Add at least one vendor quote before sending it to Finance.' : 'Finance reviews it first, then the GM and Owner.'}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button variant="accent" onClick={handleSubmit} loading={busy === 'submit'} disabled={quotes.length === 0} className="h-12">
                    <Send size={17} />
                    Submit for Finance review
                  </Button>
                  <Link
                    to={{ search: `?edit=${req.id}` }}
                    className="focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    <Pencil size={16} />
                    Edit request
                  </Link>
                  <Button variant="ghost" onClick={handleDelete} loading={busy === 'delete'} className="text-white/70 hover:!bg-white/10 hover:text-white">
                    <Trash2 size={16} />
                    Delete draft
                  </Button>
                </div>
              </div>
            </section>
          )}

          {canAct && (
            <section className="panel-dark relative overflow-hidden rounded-[1.75rem] p-6">
              <div className="relative">
                <span className="rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">Your turn</span>
                <p className="mt-3 text-2xl leading-tight font-black text-white">Review this request</p>
                {canSetAmount && (
                  <label className="mt-4 block">
                    <span className="text-xs text-white/60">Approved amount{selectedQuote ? ' · from the selected quote' : ''}</span>
                    <span className="mt-1.5 flex items-center gap-1 rounded-2xl bg-white/10 px-4 py-2.5 focus-within:ring-2 focus-within:ring-[var(--sun)]">
                      <span className="text-lg font-bold text-white/50">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={approvedInput}
                        onChange={(e) => setApprovedAmount(e.target.value)}
                        className="w-full min-w-0 bg-transparent text-lg font-bold text-white outline-none"
                      />
                    </span>
                  </label>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <Button variant="accent" onClick={handleApprove} loading={busy === 'approve'} className="h-12">
                    <Check size={18} strokeWidth={2.5} />
                    Approve
                  </Button>
                  <Button onClick={handleReturn} loading={busy === 'return'} className="h-12 border border-white/20 !bg-transparent hover:!bg-white/10">
                    <CornerUpLeft size={16} />
                    Send back for changes
                  </Button>
                  <Button onClick={handleReject} loading={busy === 'reject'} className="h-12 !bg-transparent text-white/70 hover:!bg-white/10 hover:text-white">
                    <XIcon size={16} />
                    Reject
                  </Button>
                </div>
              </div>
            </section>
          )}

          {myTurn && isRequester && (
            <section className="flex items-start gap-3 rounded-[1.75rem] bg-[var(--sun-soft)] p-5 text-sm text-[var(--ink)]">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <p>This is your own request, so another {myStage ? STAGE_LABELS[myStage] : ''} reviewer has to approve it.</p>
            </section>
          )}

          {req.status === 'approved' && canPurchase && (
            <section className="rounded-[1.75rem] bg-white p-6">
              <SectionTitle title="Record purchase" />
              <div className="space-y-2">
                <input
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  placeholder={`Actual amount paid (${formatCurrency(req.approved_amount ?? req.estimated_amount)} approved)`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="field"
                />
                <FilePick file={receiptFile} onFile={pickFile(setReceiptFile)} label="Attach receipt (optional)" />
                <Button onClick={handleRecordPurchase} loading={busy === 'purchase'} className="w-full">
                  Record purchase
                </Button>
              </div>
            </section>
          )}

          {req.status === 'purchased' && canComplete && (
            <section className="rounded-[1.75rem] bg-white p-6">
              <SectionTitle title="Close it out" />
              <p className="mb-4 text-sm text-[var(--ink-soft)]">Everything delivered? Mark the request complete.</p>
              <Button onClick={handleComplete} loading={busy === 'complete'} className="w-full">
                Mark as completed
              </Button>
            </section>
          )}

          <section className="rounded-[1.75rem] bg-white p-6">
            <SectionTitle title="Approval trail" />
            <ol className="space-y-5">
              {(['finance', 'gm', 'owner'] as const).map((stage, i) => {
                const approval = req.approvals?.find((a) => a.stage === stage)
                const decision = approval?.decision ?? 'pending'
                const current = currentStage === stage
                return (
                  <li key={stage} className="relative flex gap-3">
                    {i < 2 && <span className="absolute top-10 bottom-[-1.25rem] left-[1.1rem] w-px bg-black/10" />}
                    <span
                      className={clsx(
                        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        decision === 'approved' && 'bg-[#d3efdf] text-[#1e8c66]',
                        decision === 'rejected' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
                        decision === 'pending' && (current ? 'bg-[var(--sun)] text-[var(--ink)]' : 'bg-[var(--canvas)] text-slate-400'),
                      )}
                    >
                      {decision === 'approved' ? (
                        <Check size={16} strokeWidth={3} />
                      ) : decision === 'rejected' ? (
                        <XIcon size={16} strokeWidth={3} />
                      ) : current ? (
                        <Clock size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-semibold text-[var(--ink)]">{STAGE_LABELS[stage]}</p>
                      <p className="text-xs text-slate-500">
                        {decision === 'pending'
                          ? current
                            ? 'Waiting on review'
                            : EDITABLE_STATUSES.includes(req.status)
                              ? 'Starts after submission'
                              : 'Not reached yet'
                          : `${decision === 'approved' ? 'Approved' : 'Rejected'}${approval?.reviewer ? ` by ${approval.reviewer.full_name}` : ''}${
                              approval?.decided_at ? ` · ${format(new Date(approval.decided_at), 'MMM d')}` : ''
                            }`}
                      </p>
                      {approval?.comments && <p className="mt-1 text-xs text-[var(--ink-soft)] italic">“{approval.comments}”</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{children}</div>
    </div>
  )
}

function SectionTitle({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>
      {count !== undefined && (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--canvas)] px-2 text-xs font-medium text-[var(--ink)]">{count}</span>
      )}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

function FilePick({ file, onFile, label = 'Choose a file' }: { file: File | null; onFile: (f: File | null) => void; label?: string }) {
  return (
    <label className="field flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 !py-0 hover:border-black/20">
      <Paperclip size={16} className="shrink-0 text-slate-400" />
      <span className={clsx('min-w-0 flex-1 truncate', !file && 'text-slate-400')}>{file ? file.name : label}</span>
      {file && <span className="shrink-0 text-xs text-slate-400">{formatBytes(file.size)}</span>}
      {file && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onFile(null)
          }}
          aria-label="Remove file"
          className="text-slate-400 hover:text-[var(--ink)]"
        >
          <XIcon size={14} />
        </button>
      )}
      <input
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
    </label>
  )
}
