import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { format, formatDistanceToNow } from 'date-fns'
import { ArrowRight, Check, Clock, HardHat, MapPin, NotebookPen, UserCheck, X as XIcon } from 'lucide-react'
import { notify } from '@/lib/notify'
import { useAuth } from '@/context/AuthContext'
import { Avatar, Breadcrumbs, Button, LaborStatusBadge, useConfirm } from '@/components/ui'
import {
  fetchLaborHistory,
  fetchLaborRequest,
  formatDuration,
  isLaborManager,
  LABOR_FLOW,
  NEXT_LABOR_STATUS,
  updateLaborRequest,
} from '@/services/labor'
import { LABOR_STATUS_LABELS, ROLE_LABELS, type AuditEvent, type LaborRequest, type LaborStatus } from '@/types'

const STEP_HINTS: Record<LaborStatus, { done: string; waiting: string }> = {
  requested: { done: 'Raised by the site team', waiting: 'Being raised' },
  reviewed: { done: 'Checked by the site manager', waiting: 'Waiting on site manager review' },
  assigned: { done: 'Crew lead confirmed', waiting: 'Waiting for a crew lead' },
  in_progress: { done: 'Crew worked on site', waiting: 'Crew not on site yet' },
  completed: { done: 'Work signed off', waiting: 'Waiting for sign-off' },
  cancelled: { done: 'Request withdrawn', waiting: '' },
}

export function LaborDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const confirm = useConfirm()
  const [labor, setLabor] = useState<LaborRequest | null>(null)
  const [history, setHistory] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'advance' | 'cancel' | 'lead' | 'notes' | null>(null)
  const [lead, setLead] = useState('')
  const [notes, setNotes] = useState('')

  async function load() {
    if (!id) return
    const [l, h] = await Promise.all([fetchLaborRequest(id), fetchLaborHistory(id)])
    setLabor(l)
    setHistory(h)
    setLead(l?.assigned_to ?? '')
    setNotes(l?.management_notes ?? '')
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <p className="py-16 text-center text-sm text-slate-500">Loading labor request…</p>
  if (!labor)
    return (
      <div className="rounded-[1.75rem] bg-white px-6 py-16 text-center">
        <p className="text-2xl font-black text-[var(--ink)]">Labor request not found</p>
        <Link to="/labor" className="mt-3 inline-block text-sm font-medium text-[var(--accent)] underline underline-offset-4">
          Back to labor requests
        </Link>
      </div>
    )

  const l = labor
  const manager = isLaborManager(profile?.role)
  const isRequester = profile?.id === l.requested_by
  const closed = l.status === 'completed' || l.status === 'cancelled'
  const next = NEXT_LABOR_STATUS[l.status]
  const duration = formatDuration(l.expected_duration_hours)
  const leadChanged = lead.trim() !== (l.assigned_to ?? '')
  const notesChanged = notes.trim() !== (l.management_notes ?? '').trim()
  const reachedIndex = LABOR_FLOW.indexOf(l.status)

  async function save(kind: NonNullable<typeof busy>, patch: Parameters<typeof updateLaborRequest>[1], success: string, failure: string) {
    setBusy(kind)
    const { error } = await updateLaborRequest(l.id, patch)
    setBusy(null)
    if (error) notify.error(`${failure}: ${error}`)
    else {
      notify.success(success)
      load()
    }
  }

  async function handleAdvance() {
    if (!next) return
    const label = LABOR_STATUS_LABELS[next].toLowerCase()
    const ok = await confirm({
      title: `Move to ${label}?`,
      body:
        next === 'assigned' && !l.assigned_to
          ? 'No crew lead is set yet. You can still assign one afterwards.'
          : `${l.request_number} moves to ${label} and the requester is notified.`,
      confirmLabel: `Move to ${label}`,
      tone: 'accent',
    })
    if (ok) save('advance', { status: next }, `Labor request moved to ${label}`, 'Could not move this request')
  }

  async function handleCancel() {
    const ok = await confirm({
      title: 'Cancel this labor request?',
      body: `${l.labor_type} at ${l.location} will be withdrawn. This can't be undone.`,
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep it',
      tone: 'danger',
    })
    if (ok) save('cancel', { status: 'cancelled' }, 'Labor request cancelled, crew no longer needed', 'Could not cancel this request')
  }

  // Latest audit entry per status, for dates and names on the timeline
  const stepEvent = (status: LaborStatus) => [...history].reverse().find((e) => e.action === `labor_${status}`)

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: 'Overview', to: '/dashboard' }, { label: 'Labor requests', to: '/labor' }, { label: l.request_number }]} />

      {/* ── Hero ── */}
      <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white">{l.request_number}</span>
          <LaborStatusBadge status={l.status} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-[clamp(1.9rem,4vw,3rem)] leading-[1.02] font-black tracking-[-0.035em] break-words text-[var(--ink)]">{l.labor_type}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-[var(--ink-soft)]">
              {l.project?.name}
              <span>·</span>
              <MapPin size={14} className="shrink-0" />
              {l.location}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Workers</p>
            <p className="text-[clamp(2.2rem,5vw,3.5rem)] leading-none font-black tracking-tight text-[var(--ink)]">{l.workers_required}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-6 md:grid-cols-4">
          <Meta label="Requested by">
            <span className="flex items-center gap-2">
              {l.requester && <Avatar initials={l.requester.avatar_initials} size={26} index={l.requester.full_name.length} />}
              <span className="truncate">{l.requester?.full_name ?? '—'}</span>
            </span>
          </Meta>
          <Meta label="Needed at">{format(new Date(l.required_at), 'EEE, MMM d · h:mm a')}</Meta>
          <Meta label="Expected duration">{duration ? `${duration}${duration.endsWith('h') ? '' : ` · ${Number(l.expected_duration_hours)}h`}` : 'Not set'}</Meta>
          <Meta label="Created">{format(new Date(l.created_at), 'MMM d, yyyy')}</Meta>
        </div>

        {l.assigned_to && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--canvas)] p-4 text-sm text-[var(--ink)]">
            <UserCheck size={18} className="shrink-0 text-[#1e8c66]" />
            <p>
              <strong className="font-semibold">Crew lead:</strong> {l.assigned_to}
            </p>
          </div>
        )}
        {l.status === 'cancelled' && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--ink)]">
            <XIcon size={18} className="shrink-0 text-[var(--accent)]" />
            <p>This labor request was cancelled.</p>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ── Main column ── */}
        <div className="order-2 space-y-4 lg:order-1">
          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Notes for the crew</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--ink)]">{l.description || 'No notes were added.'}</p>
            {!manager && l.management_notes && (
              <div className="mt-6 border-t border-black/[0.06] pt-6">
                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Management notes</p>
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-[var(--ink)]">{l.management_notes}</p>
              </div>
            )}
          </section>

          <section className="rounded-[1.75rem] bg-white p-6 sm:p-8">
            <SectionTitle title="Status timeline" />
            <ol className="space-y-5">
              {LABOR_FLOW.map((status, i) => {
                const event = stepEvent(status)
                // Cancelled requests only show the steps the audit trail proves they reached
                const done = l.status === 'cancelled' ? !!event || status === 'requested' : i <= reachedIndex
                const current = l.status !== 'cancelled' && i === reachedIndex + 1
                const last = i === LABOR_FLOW.length - 1 && l.status !== 'cancelled'
                return (
                  <TimelineStep
                    key={status}
                    last={last}
                    tone={done ? 'done' : current ? 'current' : 'idle'}
                    icon={done ? <Check size={16} strokeWidth={3} /> : current ? <Clock size={16} /> : <HardHat size={16} />}
                    title={LABOR_STATUS_LABELS[status]}
                    detail={
                      event
                        ? `${event.actor?.full_name ? `${event.actor.full_name} · ` : ''}${format(new Date(event.created_at), 'MMM d, h:mm a')}`
                        : status === 'requested'
                          ? `${l.requester?.full_name ? `${l.requester.full_name} · ` : ''}${format(new Date(l.created_at), 'MMM d, h:mm a')}`
                          : current
                            ? STEP_HINTS[status].waiting
                            : done
                              ? STEP_HINTS[status].done
                              : 'Not reached yet'
                    }
                  />
                )
              })}
              {l.status === 'cancelled' && (
                <TimelineStep
                  last
                  tone="rejected"
                  icon={<XIcon size={16} strokeWidth={3} />}
                  title="Cancelled"
                  detail={(() => {
                    const event = stepEvent('cancelled')
                    return event
                      ? `${event.actor?.full_name ? `${event.actor.full_name} · ` : ''}${format(new Date(event.created_at), 'MMM d, h:mm a')}`
                      : STEP_HINTS.cancelled.done
                  })()}
                />
              )}
            </ol>
          </section>
        </div>

        {/* ── Side column: actions first ── */}
        <div className="order-1 space-y-4 lg:order-2">
          {manager && (
            <section className="panel-dark relative overflow-hidden rounded-[1.75rem] p-6">
              <div className="relative">
                <span className="rounded-full bg-[var(--sun)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">Site manager</span>
                <p className="mt-3 text-2xl leading-tight font-black text-white">
                  {closed ? `This request is ${LABOR_STATUS_LABELS[l.status].toLowerCase()}` : next ? `Next: ${LABOR_STATUS_LABELS[next].toLowerCase()}` : 'Manage this crew'}
                </p>
                {l.updated_at && <p className="mt-1 text-xs text-white/50">Updated {formatDistanceToNow(new Date(l.updated_at), { addSuffix: true })}</p>}

                <div className="mt-5 space-y-2">
                  <label htmlFor="crew-lead" className="text-xs font-medium text-white/60">
                    Crew lead
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="crew-lead"
                      value={lead}
                      onChange={(e) => setLead(e.target.value)}
                      placeholder="Assign a crew lead…"
                      className="field h-11 min-w-0 !py-0"
                    />
                    {leadChanged && (
                      <Button
                        variant="accent"
                        className="h-11 shrink-0 px-4"
                        loading={busy === 'lead'}
                        onClick={() => save('lead', { assigned_to: lead.trim() || null }, 'Crew lead saved on this labor request', 'Could not update the crew lead')}
                      >
                        Save
                      </Button>
                    )}
                  </div>
                </div>

                {!closed && (
                  <div className="mt-4 flex flex-col gap-2">
                    {next && (
                      <Button variant="accent" onClick={handleAdvance} loading={busy === 'advance'} className="h-12">
                        Move to {LABOR_STATUS_LABELS[next].toLowerCase()}
                        <ArrowRight size={18} />
                      </Button>
                    )}
                    <Button onClick={handleCancel} loading={busy === 'cancel'} className="h-12 border border-white/20 !bg-transparent hover:!bg-white/10">
                      Cancel request
                    </Button>
                  </div>
                )}

                <div className="mt-5 space-y-2 border-t border-white/10 pt-5">
                  <label htmlFor="mgmt-notes" className="flex items-center gap-2 text-xs font-medium text-white/60">
                    <NotebookPen size={14} />
                    Management notes
                  </label>
                  <textarea
                    id="mgmt-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Crew arrangements, site access, costs… Visible to the requester."
                    className="field resize-none"
                  />
                  {notesChanged && (
                    <Button
                      onClick={() => save('notes', { management_notes: notes.trim() || null }, 'Management notes saved on this request', 'Could not save the notes')}
                      loading={busy === 'notes'}
                      className="w-full border border-white/20 !bg-transparent hover:!bg-white/10"
                    >
                      Save notes
                    </Button>
                  )}
                </div>
              </div>
            </section>
          )}

          {!manager && isRequester && l.status === 'requested' && (
            <section className="rounded-[1.75rem] bg-white p-6">
              <SectionTitle title="Not needed anymore?" />
              <p className="mb-4 text-sm text-[var(--ink-soft)]">You can withdraw this request until the site manager reviews it.</p>
              <Button variant="outline" onClick={handleCancel} loading={busy === 'cancel'} className="w-full">
                Cancel request
              </Button>
            </section>
          )}

          <section className="rounded-[1.75rem] bg-white p-6">
            <SectionTitle title="Requester" />
            {l.requester ? (
              <div className="flex items-center gap-3">
                <Avatar initials={l.requester.avatar_initials} size={42} index={l.requester.full_name.length} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]">{l.requester.full_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {ROLE_LABELS[l.requester.role]}
                    {l.requester.department ? ` · ${l.requester.department}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Unknown requester.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function TimelineStep({
  tone,
  icon,
  title,
  detail,
  last,
}: {
  tone: 'done' | 'current' | 'idle' | 'rejected'
  icon: ReactNode
  title: string
  detail: string
  last?: boolean
}) {
  return (
    <li className="relative flex gap-3">
      {!last && <span className="absolute top-10 bottom-[-1.25rem] left-[1.1rem] w-px bg-black/10" />}
      <span
        className={clsx(
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          tone === 'done' && 'bg-[#d3efdf] text-[#1e8c66]',
          tone === 'rejected' && 'bg-[var(--accent-soft)] text-[var(--accent)]',
          tone === 'current' && 'bg-[var(--sun)] text-[var(--ink)]',
          tone === 'idle' && 'bg-[var(--canvas)] text-slate-400',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </li>
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

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <h2 className="text-xl font-bold text-[var(--ink)]">{title}</h2>
    </div>
  )
}
