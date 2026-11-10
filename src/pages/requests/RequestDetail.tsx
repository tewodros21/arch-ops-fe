import { useEffect, useState, type ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { format } from 'date-fns'
import { Check, Clock, FileText, PackageCheck, Paperclip, Pencil, RotateCcw, Send, ShieldCheck, Trash2, Upload, X as XIcon } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { Avatar, Breadcrumbs, Button, StatusBadge, useConfirm } from '@/components/ui'
import {
  approveStage,
  completeRequest,
  EDITABLE_STATUSES,
  recordReceipt,
  recordPurchase,
  rejectRequest,
  ROLE_STAGE,
  STAGE_LABELS,
  stageForStatus,
  submitRequest,
} from '@/lib/workflow'
import { ACCEPT_ATTR, attachFile, formatBytes, openAttachment, validateFile } from '@/lib/storage'
import {
  deletePurchaseRequest,
  loadPurchaseRequest,
  PURCHASE_SAVED_EVENT,
  type PurchaseUnavailable,
} from '@/services/requests'
import { ATTACHMENT_TYPE_LABELS, ROLE_LABELS, type ApprovalStage, type AttachmentType, type PurchaseAttachment, type PurchaseRequest } from '@/types'
import { formatCurrency } from '@/utils'

export function RequestDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [request, setRequest] = useState<PurchaseRequest | null>(null)
  const [unavailable, setUnavailable] = useState<PurchaseUnavailable | null>(null)
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Which action is running, so only that button spins
  const [busy, setBusy] = useState<string | null>(null)
  const [approvedAmount, setApprovedAmount] = useState<string | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState('')
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({})
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<AttachmentType>('other')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)

  async function load() {
    if (!id) {
      setRequest(null)
      setUnavailable('missing')
      setUnavailableMessage(null)
      setLoading(false)
      return
    }
    const result = await loadPurchaseRequest(id)
    setRequest(result.data)
    setUnavailable(result.unavailable)
    setUnavailableMessage(result.message)
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
  if (!request) {
    const title =
      unavailable === 'sent_back'
        ? 'This purchase was sent back'
        : unavailable === 'with_requester'
          ? 'This purchase is with the requester'
          : 'Request not found'
    const body =
      unavailable === 'sent_back'
        ? unavailableMessage || 'The requester can edit and resubmit. It will come back to Finance when they are ready.'
        : unavailable === 'with_requester'
          ? unavailableMessage || 'Only the requester can open it while it is a draft or waiting on Proforma changes.'
          : 'This purchase request could not be opened.'
    return (
      <div className="rounded-[1.75rem] bg-white px-6 py-16 text-center">
        <p className="text-2xl font-black text-[var(--ink)]">{title}</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">{body}</p>
        <Link to="/requests" className="mt-5 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-4">
          Back to requests
        </Link>
      </div>
    )
  }

  const req = request
  const role = profile?.role
  const isShopkeeper = role === 'shopkeeper'
  const isRequester = !!profile && profile.id === req.requester_id
  const myStage = role ? ROLE_STAGE[role] : null
  const currentStage = stageForStatus(req.status)
  const myTurn = !!myStage && currentStage === myStage
  // The server blocks self-approval too; hide the panel instead of letting it fail
  const canAct = myTurn && !isRequester
  const editable = isRequester && EDITABLE_STATUSES.includes(req.status)
  const canPurchase = role === 'finance'
  const canSetAmount = role === 'finance' && currentStage === 'finance'
  const hasProforma = !!(
    req.vendor_name?.trim() &&
    req.vendor_location?.trim() &&
    Number(req.proforma_amount) > 0 &&
    req.attachments?.some((attachment) => attachment.attachment_type === 'proforma')
  )
  const requestDate = req.submitted_at ?? req.created_at

  const items = req.items ?? []
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.estimated_unit_price ?? 0), 0)
  const allItemsReceived = items.length > 0 && items.every((item) => Number(item.received_quantity ?? 0) >= Number(item.quantity))
  const canComplete = isShopkeeper && allItemsReceived && ['purchased', 'partially_received'].includes(req.status)
  const approvalStages: ApprovalStage[] = [
    ...(req.requester?.role === 'project_manager' && !req.approvals?.some((approval) => approval.stage === 'project_manager')
      ? []
      : ['project_manager' as const]),
    'finance',
    ...(req.approvals?.some((approval) => approval.stage === 'gm') ? ['gm' as const] : []),
    ...(req.approvals?.some((approval) => approval.stage === 'owner') ? ['owner' as const] : []),
  ]
  const defaultApproved = Number(req.proforma_amount ?? req.approved_amount ?? req.estimated_amount)
  const approvedInput = approvedAmount ?? String(defaultApproved)
  const nextStep = currentStage === 'project_manager' ? 'Finance' : 'purchasing'

  // Hero shows the latest known figure large, the others underneath
  const amounts = (isShopkeeper ? [] : [
    { label: 'Estimated', value: req.estimated_amount },
    { label: 'Approved', value: req.approved_amount },
    { label: 'Paid', value: req.actual_amount },
  ]).filter((a) => a.value != null)
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
      title: 'Submit this request?',
      body: 'You will not be able to edit it while it is being reviewed.',
      confirmLabel: 'Submit request',
      tone: 'accent',
      icon: Send,
    })
    if (ok) {
      const next = role === 'project_manager' ? 'Finance' : 'the assigned Project Manager'
      await run('submit', () => submitRequest(req.id), `Request submitted for ${next} review`, 'Could not submit this request')
    }
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this draft?',
      body: `${req.request_number} and its items and documents will be removed for good.`,
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
      body: 'All ordered item quantities have been received. This closes the request.',
      confirmLabel: 'Mark completed',
      tone: 'accent',
    })
    if (ok) await run('complete', () => completeRequest(req.id), 'Request marked as completed, all done here', 'Could not complete this request')
  }

  async function handleReceive() {
    const receiptItems = items
      .flatMap((item) => {
        const quantity = receiptQuantities[item.id]?.trim()
        if (!quantity) return []
        return [{
          purchase_item_id: item.id,
          quantity_received: Number(quantity),
          quantity_remaining: Number(item.quantity_remaining ?? item.quantity),
        }]
      })
    if (!receiptItems.length || receiptItems.some((item) => !Number.isFinite(item.quantity_received) || item.quantity_received <= 0)) {
      notify.warning('Enter a received quantity for at least one item')
      return
    }
    if (receiptItems.some((item) => item.quantity_received > item.quantity_remaining)) {
      notify.warning('A received quantity cannot exceed the remaining quantity')
      return
    }
    const saved = await run(
      'receive',
      () => recordReceipt(req.id, receiptItems.map((item) => ({
        purchase_item_id: item.purchase_item_id,
        quantity_received: item.quantity_received,
      }))),
      'Delivery quantities recorded',
      'Could not record this delivery',
    )
    if (saved) setReceiptQuantities({})
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
              {[req.project?.name, req.department].filter(Boolean).join(' · ')}
            </p>
          </div>
          {!isShopkeeper && headline && (
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
          )}
        </div>

        {!isShopkeeper && <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-6 md:grid-cols-4">
          <Meta label="Requester">
            <span className="flex items-center gap-2">
              {req.requester && <Avatar initials={req.requester.avatar_initials} size={26} />}
              <span className="truncate">{req.requester?.full_name}</span>
            </span>
          </Meta>
          <Meta label="Role">{req.requester ? ROLE_LABELS[req.requester.role] : '—'}</Meta>
          <Meta label="Needed by">{req.required_date ? format(new Date(`${req.required_date}T00:00`), 'MMM d, yyyy') : 'Not set'}</Meta>
          {requestDate && <Meta label={req.submitted_at ? 'Submitted' : 'Created'}>{format(new Date(requestDate), 'MMM d, yyyy')}</Meta>}
        </div>}

        {!isShopkeeper && req.return_note && EDITABLE_STATUSES.includes(req.status) && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--sun-soft)] p-4 text-sm text-[var(--ink)]">
            <RotateCcw size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong className="font-semibold">Sent back for changes:</strong> {req.return_note}
            </p>
          </div>
        )}

        {!isShopkeeper && req.rejection_reason && req.status === 'rejected' && (
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
          {!isShopkeeper && (req.description || req.justification) && (
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
                <div className={clsx(
                  'hidden gap-3 px-4 pb-2 text-xs font-medium tracking-wide text-slate-500 uppercase sm:grid',
                  isShopkeeper ? 'grid-cols-[minmax(0,1fr)_7rem_7rem_9rem]' : 'grid-cols-[minmax(0,1fr)_6rem_7rem_7rem]',
                )}>
                  <span>Item</span>
                  {isShopkeeper ? (
                    <>
                      <span className="text-right">Received</span>
                      <span className="text-right">Remaining</span>
                      <span className="text-right">Receive now</span>
                    </>
                  ) : (
                    <>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Unit price (ETB)</span>
                      <span className="text-right">Total</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2">
                  {items.map((item) => {
                    const total = Number(item.quantity) * Number(item.estimated_unit_price ?? 0)
                    const received = Number(item.received_quantity ?? 0)
                    const remaining = Number(item.quantity_remaining ?? item.quantity)
                    return (
                      <li
                        key={item.id}
                        className={clsx(
                          'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-2xl bg-[var(--canvas)] px-4 py-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_7rem]',
                          isShopkeeper && 'sm:grid-cols-[minmax(0,1fr)_7rem_7rem_9rem]',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--ink)]">{item.name}</p>
                          {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
                          {!isShopkeeper && <p className="text-xs text-slate-500 sm:hidden">
                            {Number(item.quantity).toLocaleString()} {item.unit}
                            {item.estimated_unit_price != null && ` × ${formatCurrency(item.estimated_unit_price)}`}
                          </p>}
                        </div>
                        {isShopkeeper ? (
                          <>
                            <span className="text-right text-sm text-[var(--ink-soft)]">
                              <span className="block text-[10px] uppercase text-slate-400 sm:hidden">Received</span>
                              {received.toLocaleString()} {item.unit}
                            </span>
                            <span className="text-right text-sm font-semibold text-[var(--ink)]">
                              <span className="block text-[10px] uppercase text-slate-400 sm:hidden">Remaining</span>
                              {remaining.toLocaleString()} {item.unit}
                            </span>
                            <div>
                              <span className="block text-[10px] uppercase text-slate-400 sm:hidden">Receive now</span>
                              <input
                                aria-label={`Quantity received now for ${item.name}`}
                                type="number"
                                min="0"
                                max={remaining}
                                step="0.01"
                                value={receiptQuantities[item.id] ?? ''}
                                onChange={(event) => setReceiptQuantities((current) => ({ ...current, [item.id]: event.target.value }))}
                                disabled={remaining <= 0 || req.status === 'completed'}
                                className="field h-10 min-w-0 !px-2 !py-0 text-right"
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="hidden text-right text-sm text-[var(--ink-soft)] sm:block">
                              {Number(item.quantity).toLocaleString()} {item.unit}
                            </span>
                            <span className="hidden text-right text-sm text-[var(--ink-soft)] sm:block">
                              {item.estimated_unit_price != null ? formatCurrency(item.estimated_unit_price) : '—'}
                            </span>
                            <span className="text-right text-sm font-bold text-[var(--ink)]">{total > 0 ? formatCurrency(total) : '—'}</span>
                          </>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {!isShopkeeper && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] px-4 pt-3">
                  <span className="text-sm text-[var(--ink-soft)]">
                    Items total
                    {itemsTotal > 0 && Math.abs(itemsTotal - Number(req.estimated_amount)) > 0.005 && ` · estimate ${formatCurrency(req.estimated_amount)}`}
                  </span>
                  <span className="text-xl font-black tracking-tight text-[var(--ink)]">{formatCurrency(itemsTotal)}</span>
                </div>}
              </>
            )}
            {isShopkeeper && ['purchased', 'partially_received'].includes(req.status) && items.length > 0 && (
              <div className="mt-5 border-t border-black/[0.06] pt-4">
                <Button onClick={handleReceive} loading={busy === 'receive'} className="w-full sm:w-auto">
                  <PackageCheck size={17} />
                  Record received quantities
                </Button>
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Vendor & Proforma" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Meta label="Vendor">{req.vendor_name || 'Not provided'}</Meta>
              <Meta label="Vendor location">{req.vendor_location || 'Not provided'}</Meta>
              {!isShopkeeper && req.proforma_amount != null && (
                <Meta label="Proforma amount">{formatCurrency(req.proforma_amount)}</Meta>
              )}
            </div>
            {!isShopkeeper && req.attachments?.some((attachment) => attachment.attachment_type === 'proforma') && (
              <div className="mt-4 border-t border-black/[0.06] pt-4">
                {req.attachments
                  .filter((attachment) => attachment.attachment_type === 'proforma')
                  .map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => handleOpenDocument(attachment)}
                      className="focus-ring flex items-center gap-3 rounded-2xl bg-[var(--canvas)] px-4 py-3 text-left"
                    >
                      <FileText size={17} className="text-[var(--accent)]" />
                      <span className="truncate text-sm font-medium text-[var(--ink)]">{attachment.file_name}</span>
                      <span className="shrink-0 text-xs text-slate-500">Open Proforma</span>
                    </button>
                  ))}
              </div>
            )}
          </section>

          {!isShopkeeper && <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
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
          </section>}
        </div>

        {/* ── Side column: actions first so approvers see them immediately ── */}
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          {editable && (
            <section className="panel-dark relative overflow-hidden rounded-[1.75rem] p-6">
              <div className="relative">
                <span className="rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                  {req.status === 'draft' ? 'Draft' : 'Proforma received'}
                </span>
                <p className="mt-3 text-2xl leading-tight font-black text-white">Ready to submit?</p>
                <p className="mt-1 text-sm text-white/60">
                  {!hasProforma
                    ? 'Complete vendor details and attach the Proforma before submitting for review.'
                    : role === 'project_manager'
                      ? 'Finance reviews this request after you submit it.'
                      : 'Submit this request to the assigned Project Manager. Project Manager requests go directly to Finance.'}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button variant="accent" onClick={handleSubmit} loading={busy === 'submit'} disabled={!hasProforma} className="h-12">
                    <Send size={17} />
                    Submit for review
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
                    <span className="text-xs text-white/60">Approved amount · Proforma</span>
                    <span className="mt-1.5 flex items-center gap-1 rounded-2xl bg-white/10 px-4 py-2.5 focus-within:ring-2 focus-within:ring-[var(--sun)]">
                      <span className="text-sm font-bold text-white/50">ETB</span>
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

          {canComplete && (
            <section className="rounded-[1.75rem] bg-white p-6">
              <SectionTitle title="Close it out" />
              <p className="mb-4 text-sm text-[var(--ink-soft)]">All item quantities are received. Mark the request complete.</p>
              <Button onClick={handleComplete} loading={busy === 'complete'} className="w-full">
                Mark as completed
              </Button>
            </section>
          )}

          {!isShopkeeper && <section className="rounded-[1.75rem] bg-white p-6">
            <SectionTitle title="Approval trail" />
            <ol className="space-y-5">
              {approvalStages.map((stage, i) => {
                const approval = req.approvals?.find((a) => a.stage === stage)
                const decision = approval?.decision ?? 'pending'
                const current = currentStage === stage
                return (
                  <li key={stage} className="relative flex gap-3">
                    {i < approvalStages.length - 1 && <span className="absolute top-10 bottom-[-1.25rem] left-[1.1rem] w-px bg-black/10" />}
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
          </section>}
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
