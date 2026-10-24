import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowRight, ArrowUpRight, Asterisk, Check, Quote, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { AssetSlot } from '@/components/ui'
import { ROLE_LABELS, type Role } from '@/types'

const WORKFLOW = ['Request', 'Quote', 'Finance', 'GM', 'Owner', 'Purchase', 'Complete']

const STAGES = [
  { n: '01', title: 'Finance', body: 'Checks pricing and budget before anything moves. The first gate on every spend.' },
  { n: '02', title: 'General Manager', body: 'Confirms the work is operationally justified on site.' },
  { n: '03', title: 'Owner', body: 'Final sign-off where required, with the full financial picture.' },
]

// Role cards: drop cut-out PNGs (transparent background) into public/assets/roles/
const ROLES: { role: Role; blurb: string; bg: string; fg: string }[] = [
  { role: 'employee', blurb: 'Raises requests, attaches quotes and tracks status without chasing anyone.', bg: 'var(--accent-soft)', fg: 'var(--ink)' },
  { role: 'finance', blurb: 'Reviews pricing and budget. The first checkpoint on every spend.', bg: 'var(--sun)', fg: 'var(--ink)' },
  { role: 'general_manager', blurb: 'Makes sure the work is justified before it reaches final sign-off.', bg: 'var(--accent)', fg: '#ffffff' },
  { role: 'owner', blurb: 'Gives final approval and sees spend across every project.', bg: 'var(--panel-dark)', fg: '#ffffff' },
  { role: 'admin', blurb: 'Runs users, projects, vendors and the rules the workflow follows.', bg: '#e6e1da', fg: 'var(--ink)' },
]

const BEFORE = ['Phone calls for every request', 'Screenshots as the only record', 'No idea what is pending or late', 'Manual follow-ups on every purchase']
const AFTER = ['One request, routed automatically', 'Quotes and receipts attached', 'Live view of pending and delayed spend', 'Audit trail nobody can edit']

export function Home() {
  const { profile } = useAuth()
  const scope = useRef<HTMLDivElement>(null)
  const primaryTo = profile ? '/dashboard' : '/login'
  const { hash, key } = useLocation()

  // Router links to /#section don't scroll by themselves; key re-runs it when the same link is clicked again
  useEffect(() => {
    if (!hash) return
    const t = window.setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 120)
    return () => window.clearTimeout(t)
  }, [hash, key])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-line', { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.08 })
      gsap.from('.hero-cell', { opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.2 })
      gsap.to('.float-slow', { y: -14, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, scope)
    return () => ctx.revert()
  }, [])

  return (
    <div ref={scope} className="app-shell relative z-10 min-h-screen overflow-x-hidden">
      <div className="px-4 sm:px-6">
        <SiteHeader />

        {/* ── Hero bento ── */}
        <section className="grid min-h-[calc(100svh-5.5rem)] grid-cols-1 gap-3 pb-3 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)_minmax(15rem,auto)]">
          <div className="hero-cell relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-white p-6 sm:p-10 lg:col-span-7">
            <span className="w-fit rounded-full border-[1.5px] border-[var(--accent)] px-4 py-1.5 text-xs font-medium tracking-wide text-[var(--ink)] uppercase">
              Procurement & labor · Architecture firms
            </span>

            <h1 className="my-10 text-[clamp(3rem,6.4vw,7.25rem)] leading-[0.88] font-black tracking-[-0.045em] text-[var(--ink)]">
              <span className="block overflow-hidden"><span className="hero-line block">Every spend.</span></span>
              <span className="block overflow-hidden"><span className="hero-line block">Signed</span></span>
              <span className="block overflow-hidden">
                <span className="hero-line block">
                  off<span className="text-[var(--accent)]">.</span>
                </span>
              </span>
            </h1>

            {/* Swoosh arrow pointing at the hero asset */}
            {/* One continuous stroke: the curve ends at the tip (150,40) and the head's two arms
                are set ±35° off the curve's final tangent, so the head always sits on the line.
                The viewBox keeps a 10px margin so the round caps never clip. */}
            <svg
              viewBox="0 0 170 100"
              className="arrow-draw absolute top-[32%] right-6 hidden w-44 text-[var(--sun)] lg:block"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M14 84 C 50 22, 108 12, 150 40 M120 40 L150 40 L140 12"
                pathLength={1}
                stroke="currentColor"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={primaryTo}
                className="focus-ring inline-flex bg-[#f6b73c] hover:bg-[#f2aa1f] h-14 items-center gap-2 rounded-full px-8 text-base font-semibold text-[var(--ink)] transition-[background-color,transform] active:scale-[0.98]"
              >
                {profile ? 'Open dashboard' : 'Get started'}
              </Link>
              <a
                href="#workflow"
                aria-label="See the workflow"
                className="focus-ring flex h-14 w-14 items-center justify-center rounded-full border border-black/20 text-[var(--ink)] hover:bg-[var(--canvas)]"
              >
                <ArrowRight size={20} />
              </a>
              <p className="ml-1 max-w-xs text-sm text-[var(--ink-soft)]">
                Requests, quotes and three-level approvals in one clear record.
              </p>
            </div>
          </div>

          {/* Hero 3D asset */}
          <div className="hero-cell panel-dark relative min-h-[26rem] overflow-hidden rounded-[2rem] lg:col-span-5 lg:row-span-2">
            <p className="text-outline absolute -right-4 bottom-4 text-[clamp(5rem,11vw,10rem)] leading-[0.8] font-black tracking-tighter select-none [writing-mode:vertical-rl]">
              APPROVED
            </p>
            <Asterisk className="absolute top-8 left-8 text-[var(--sun)]" size={40} strokeWidth={2.5} />
            <span className="absolute top-9 right-9 h-5 w-5 rounded-full border-2 border-white/60" />

            <div className="float-slow absolute inset-10 flex items-center justify-center">
              <AssetSlot src="/assets/3d/hero.png" label="Hero 3D asset" dark className="h-full max-h-[34rem] w-full" />
            </div>

            <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-white backdrop-blur-md">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sun)] text-[var(--ink)]">
                <Check size={18} strokeWidth={3} />
              </span>
              <div>
                <p className="text-sm font-semibold">PR-2026-014 approved</p>
                <p className="text-xs text-white/60">Finance → GM → Owner</p>
              </div>
            </div>
          </div>

          <div className="hero-cell grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-7">
            <div className="flex flex-col justify-between rounded-[2rem] bg-[#e6e1da] p-7">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xl leading-snug font-medium text-[var(--ink)]">
                  No more phone calls, screenshots or lost quotes to get a purchase approved.
                </p>
                <Quote size={28} className="shrink-0 fill-[var(--ink)] text-[var(--ink)]" />
              </div>
              <p className="mt-6 text-sm font-extrabold tracking-[0.2em] text-[var(--ink)] uppercase">One clear record</p>
            </div>

            <div className="flex flex-col justify-between rounded-[2rem] bg-[var(--sun)] p-7">
              <p className="text-xl leading-snug font-semibold text-[var(--ink)]">
                Five roles, one workflow, and everyone knows what's waiting on them.
              </p>
              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex -space-x-2">
                  {['EM', 'FI', 'GM', 'OW', 'AD'].map((i, idx) => (
                    <span
                      key={i}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--sun)] text-xs font-bold"
                      style={{ background: idx % 2 ? 'var(--ink)' : 'var(--accent)', color: '#fff' }}
                    >
                      {i}
                    </span>
                  ))}
                </div>
                <a href="#roles" className="text-sm font-semibold text-[var(--ink)] underline underline-offset-4">
                  Meet the roles
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Marquee ── */}
      <div className="overflow-hidden bg-[var(--ink)] py-5 text-white" aria-hidden="true">
        <div className="marquee-track flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {WORKFLOW.map((step) => (
                <span key={step} className="flex items-center gap-8 pr-8 text-[clamp(2rem,4vw,3.5rem)] font-black tracking-tight uppercase">
                  {step}
                  <Asterisk className="text-[var(--accent)]" size={36} strokeWidth={3} />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-4 py-3 sm:px-6">
        {/* ── Workflow ── */}
        <section id="workflow" className="grid scroll-mt-4 grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="relative flex min-h-[30rem] flex-col justify-between overflow-hidden rounded-[2rem] bg-white p-6 sm:p-10 lg:col-span-5">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">The workflow</p>
              <h2 className="mt-4 text-[clamp(2.5rem,5vw,4.75rem)] leading-[0.92] font-black tracking-[-0.04em] text-[var(--ink)]">
                Three sign-offs. Zero chasing.
              </h2>
            </div>
            <AssetSlot src="/assets/3d/workflow.png" label="Workflow 3D asset" className="mt-6 h-72 w-full sm:h-80 lg:-mx-4 lg:w-[calc(100%+2rem)]" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-7">
            {STAGES.map((s, i) => (
              <div
                key={s.n}
                className="flex min-h-[18rem] flex-col justify-between rounded-[2rem] p-7"
                style={{
                  background: i === 1 ? 'var(--accent)' : i === 2 ? 'var(--panel-dark)' : '#e6e1da',
                  color: i === 0 ? 'var(--ink)' : '#fff',
                }}
              >
                <span className="text-[clamp(3.5rem,6vw,5.5rem)] leading-none font-black tracking-tighter">{s.n}</span>
                <div>
                  <h3 className="text-2xl font-bold" style={{ color: 'inherit' }}>{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed opacity-80">{s.body}</p>
                </div>
              </div>
            ))}
            <div className="panel-dark relative flex flex-col justify-between gap-6 overflow-hidden rounded-[2rem] p-7 sm:col-span-3 sm:flex-row sm:items-end">
              <h3 className="relative max-w-md text-3xl leading-tight font-bold text-white">
                Every approval, rejection and change is logged. Nobody can edit history.
              </h3>
              <span className="relative w-fit shrink-0 rounded-full bg-[var(--sun)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">
                Full audit trail
              </span>
            </div>
          </div>
        </section>

        {/* ── Roles ── */}
        <section id="roles" className="scroll-mt-4 rounded-[2rem] bg-white p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-3xl text-[clamp(2.5rem,5vw,4.75rem)] leading-[0.92] font-black tracking-[-0.04em] text-[var(--ink)]">
              Built for everyone who touches a purchase.
            </h2>
            <p className="max-w-xs text-sm text-[var(--ink-soft)]">Each role sees exactly what's waiting on them, and nothing they shouldn't.</p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ROLES.map((r) => (
              <article
                key={r.role}
                className="relative flex h-[30rem] flex-col overflow-hidden rounded-[1.75rem] border border-black/[0.06] p-6"
                style={{ background: r.bg, color: r.fg }}
              >
                <h3 className="text-2xl leading-tight font-black tracking-tight" style={{ color: 'inherit' }}>
                  {ROLE_LABELS[r.role]}
                </h3>
                <p className="mt-2 text-sm leading-relaxed opacity-80">{r.blurb}</p>
                {/* Cut-out is sized by height so the person fills the card, standing on its bottom edge */}
                <div className="relative mt-5 min-h-0 flex-1">
                  <AssetSlot
                    src={`/assets/roles/${r.role}.png`}
                    label={`${ROLE_LABELS[r.role]} cut-out`}
                    dark={r.fg === '#ffffff'}
                    className="absolute"
                    placeholderClassName="inset-0"
                    imgClassName="-bottom-6 left-1/2 h-[calc(100%+3rem)] w-auto max-w-none -translate-x-1/2 object-bottom"
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── Before / after ── */}
        <section id="why" className="grid scroll-mt-4 grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-[#e6e1da] p-6 sm:p-10">
            <p className="text-sm font-semibold tracking-[0.2em] text-[var(--ink-soft)] uppercase">Before</p>
            <ul className="mt-6 space-y-4">
              {BEFORE.map((b) => (
                <li key={b} className="flex items-center gap-4 text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold text-[var(--ink)]/50 line-through decoration-2">
                  <X size={24} className="shrink-0 text-[var(--ink)]/40" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="cta-card rounded-[2rem] p-6 text-white sm:p-10">
            <p className="text-sm font-semibold tracking-[0.2em] text-white/75 uppercase">With Arch Ops</p>
            <ul className="mt-6 space-y-4">
              {AFTER.map((a) => (
                <li key={a} className="flex items-center gap-4 text-[clamp(1.25rem,2.2vw,1.75rem)] font-semibold">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--accent)]">
                    <Check size={18} strokeWidth={3} />
                  </span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Closing CTA ── */}
        <section className="panel-dark relative grid min-h-[28rem] grid-cols-1 overflow-hidden rounded-[2rem] lg:grid-cols-2">
          <div className="relative flex flex-col justify-between gap-10 p-6 sm:p-10">
            <h2 className="text-[clamp(3rem,7vw,7rem)] leading-[0.88] font-black tracking-[-0.045em] text-white">
              Ready to sign off<span className="text-[var(--accent)]">?</span>
            </h2>
            <Link
              to={primaryTo}
              className="focus-ring inline-flex bg-white hover:bg-[#f3f1ee] transition-colors h-14 w-fit items-center gap-2 rounded-full px-8 text-base font-semibold text-[var(--ink)]"
            >
              {profile ? 'Open dashboard' : 'Sign in'}
              <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="relative flex items-center justify-center p-6 sm:p-10">
            <AssetSlot src="/assets/3d/cta.png" label="Closing 3D asset" dark className="float-slow h-80 w-full sm:h-[26rem]" />
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-2 py-6 text-sm text-[var(--ink-soft)]">
          <img src="/brand/logo-dark.png" alt="Arch Ops" className="h-5 w-auto" draggable={false} />
          <a href="https://ethix.dev" target="_blank" rel="noopener noreferrer" className="font-medium text-[var(--ink)] underline-offset-4 hover:text-[var(--accent)] hover:underline">
            Built by Ethix.dev
          </a>
        </footer>
      </div>
    </div>
  )
}
