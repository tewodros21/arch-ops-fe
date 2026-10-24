import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { ArrowRight, Building2, CalendarDays, Clock, HardHat, MapPin, Minus, Plus } from 'lucide-react'
import { notify } from '@/lib/notify'
import { fetchProjects } from '@/services/requests'
import { useAuth } from '@/context/AuthContext'
import { ReviewTile, StepField as Field, StepModal, type Step } from '@/components/ui/StepModal'
import { LABOR_CREATED_EVENT } from '@/constants'
import { createLaborRequest, DURATION_PRESETS, formatDuration } from '@/services/labor'
import type { Project } from '@/types'

const STEPS: Step[] = [
  { title: 'Crew', hint: 'Project, trade and headcount' },
  { title: 'Where & when', hint: 'Location on site and timing' },
  { title: 'Review', hint: 'Check and send' },
]

const QUICK_TYPES = ['General laborers', 'Electricians', 'Plumbers', 'Carpenters', 'Masons', 'Welders']

const EMPTY_FORM = { project_id: '', labor_type: '', workers_required: 1, location: '', description: '', required_at: '', expected_duration_hours: '' }

export function LaborRequestModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    fetchProjects().then(setProjects)
  }, [])

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const hours = Number(form.expected_duration_hours) > 0 ? Number(form.expected_duration_hours) : null
  const duration = formatDuration(hours)

  const stepErrors: Record<number, string | null> = {
    0: !form.project_id ? 'Choose which project needs this crew' : !form.labor_type.trim() ? 'Pick or type the trade you need' : null,
    1: !form.location.trim() ? 'Add where on site the crew goes' : !form.required_at ? 'Choose when the crew is needed' : null,
    2: null,
  }
  const err = (s: number, when: boolean) => showErrors && step === s && when

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

  async function submit(close: () => void) {
    if (!profile) return
    setBusy(true)
    // request_number and requested_by are set server side
    const { error } = await createLaborRequest({
      project_id: form.project_id,
      labor_type: form.labor_type.trim(),
      workers_required: form.workers_required,
      location: form.location.trim(),
      description: form.description,
      required_at: new Date(form.required_at).toISOString(),
      expected_duration_hours: hours,
    })
    setBusy(false)
    if (error) {
      notify.error(`Could not create labor request: ${error}`)
      return
    }
    notify.success('Labor request created and sent for review')
    window.dispatchEvent(new Event(LABOR_CREATED_EVENT))
    close()
  }

  const project = projects.find((p) => p.id === form.project_id)
  const when = form.required_at ? format(new Date(form.required_at), 'EEE, MMM d · h:mm a') : null
  const dirty =
    !!(form.project_id || form.labor_type || form.location || form.description || form.required_at || form.expected_duration_hours) ||
    form.workers_required !== 1

  return (
    <StepModal
      title="Request labor"
      icon={HardHat}
      steps={STEPS}
      step={step}
      onNext={next}
      onBack={() => setStep((s) => s - 1)}
      onGoTo={goTo}
      onSubmit={submit}
      submitLabel="Send labor request"
      busy={busy}
      dirty={dirty}
      onClose={onClose}
      summary={
        <>
          <p className="truncate text-sm text-white">{form.labor_type || 'No trade yet'}</p>
          <div className="flex items-end justify-between gap-2">
            <span className="truncate text-xs text-white/50">{project?.name ?? 'No project yet'}</span>
            <span className="text-xl font-bold whitespace-nowrap text-white">
              {form.workers_required} <span className="text-xs font-medium text-white/50">worker{form.workers_required === 1 ? '' : 's'}</span>
            </span>
          </div>
          {when && (
            <p className="text-xs text-white/50">
              {when}
              {duration && ` · ${duration}`}
            </p>
          )}
          <div className="flex items-center gap-1.5 border-t border-white/10 pt-3 text-[11px] text-white/55">
            <span className="rounded-full bg-[var(--sun)] px-2 py-0.5 font-semibold text-[var(--ink)]">Review</span>
            <ArrowRight size={12} />
            <span>Assigned</span>
            <ArrowRight size={12} />
            <span>On site</span>
          </div>
        </>
      }
    >
      {step === 0 && (
        <>
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
                    <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--canvas)] text-[var(--ink)]')}>
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
              {projects.length === 0 && <p className="text-sm text-slate-500">Loading projects…</p>}
            </div>
          </Field>

          <Field label="Who do you need?" error={err(0, !!form.project_id && !form.labor_type.trim())}>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_TYPES.map((t) => (
                <button key={t} type="button" className="chip focus-ring !px-3.5 !py-1.5" aria-pressed={form.labor_type === t} onClick={() => update('labor_type', t)}>
                  {t}
                </button>
              ))}
            </div>
            <input
              placeholder="Or type a trade, e.g. Tile setters"
              value={form.labor_type}
              onChange={(e) => update('labor_type', e.target.value)}
              className={clsx('field', err(0, !!form.project_id && !form.labor_type.trim()) && '!border-[var(--accent)]')}
            />
          </Field>

          <Field label="How many workers?">
            <div className="flex items-center gap-4 rounded-[1.5rem] bg-[var(--canvas)] p-2 pr-5">
              <StepButton label="Fewer workers" disabled={form.workers_required <= 1} onClick={() => update('workers_required', form.workers_required - 1)}>
                <Minus size={20} />
              </StepButton>
              <input
                type="number"
                min={1}
                value={form.workers_required}
                onChange={(e) => update('workers_required', Math.max(1, Number(e.target.value) || 1))}
                aria-label="Number of workers"
                className="w-20 bg-transparent text-center text-5xl font-black tracking-tight text-[var(--ink)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <StepButton label="More workers" onClick={() => update('workers_required', form.workers_required + 1)}>
                <Plus size={20} />
              </StepButton>
              <span className="ml-auto text-sm text-[var(--ink-soft)]">worker{form.workers_required === 1 ? '' : 's'} on site</span>
            </div>
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <Field label="Location on site" error={err(1, !form.location.trim())}>
            <div className="relative">
              <MapPin size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="e.g. Block A, level 3"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                className={clsx('field pl-11', err(1, !form.location.trim()) && '!border-[var(--accent)]')}
              />
            </div>
          </Field>

          <Field label="Needed at" error={err(1, !!form.location.trim() && !form.required_at)}>
            <div className="relative">
              <CalendarDays size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                value={form.required_at}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => update('required_at', e.target.value)}
                className={clsx('field pl-11', err(1, !!form.location.trim() && !form.required_at) && '!border-[var(--accent)]')}
              />
            </div>
          </Field>

          <Field label="Expected duration" optional>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d.label}
                  type="button"
                  className="chip focus-ring !px-3.5 !py-1.5"
                  aria-pressed={hours === d.hours}
                  onClick={() => update('expected_duration_hours', hours === d.hours ? '' : String(d.hours))}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Clock size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min={0.5}
                step={0.5}
                inputMode="decimal"
                placeholder="Or type the hours, e.g. 12"
                value={form.expected_duration_hours}
                onChange={(e) => update('expected_duration_hours', e.target.value)}
                aria-label="Expected duration in hours"
                className="field pr-16 pl-11"
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-slate-400">hours</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Working time: 1 day is 8 hours, 1 week is 40.</p>
          </Field>

          <Field label="Notes for the crew" optional>
            <textarea
              rows={4}
              placeholder="Scope of work, tools to bring, site access…"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="field resize-none"
            />
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <div className="rounded-[1.5rem] bg-[var(--canvas)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{project?.name}</p>
                <p className="mt-1 text-xl font-bold text-[var(--ink)]">{form.labor_type}</p>
                {form.description && <p className="mt-1 text-sm text-[var(--ink-soft)]">{form.description}</p>}
              </div>
              <p className="text-4xl font-black tracking-tight text-[var(--ink)]">
                {form.workers_required}
                <span className="ml-1.5 text-sm font-medium text-slate-500">worker{form.workers_required === 1 ? '' : 's'}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ReviewTile label="Location" value={form.location} onEdit={() => setStep(1)} />
            <ReviewTile label="Needed at" value={when ?? 'Not set'} onEdit={() => setStep(1)} />
            <ReviewTile label="Expected duration" value={duration ? `${duration}${duration.endsWith('h') ? '' : ` (${hours}h)`}` : 'Not set'} onEdit={() => setStep(1)} />
          </div>

          <div className="flex items-center gap-3 rounded-[1.5rem] bg-[var(--sun-soft)] p-4 text-sm text-[var(--ink)]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sun)]">
              <ArrowRight size={16} />
            </span>
            The site manager reviews it, then assigns a crew lead.
          </div>
        </>
      )}
    </StepModal>
  )
}

function StepButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[var(--ink)]"
    >
      {children}
    </button>
  )
}
