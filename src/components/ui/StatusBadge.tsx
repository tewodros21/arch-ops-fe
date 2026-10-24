import { STATUS_COLORS, STATUS_LABELS, LABOR_STATUS_LABELS, type RequestStatus, type LaborStatus } from '@/types'

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 13%, white)`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge color={STATUS_COLORS[status]} label={STATUS_LABELS[status]} />
}

const LABOR_COLORS: Record<LaborStatus, string> = {
  requested: 'var(--status-draft)',
  reviewed: 'var(--status-amber)',
  assigned: 'var(--status-blue)',
  in_progress: 'var(--status-purple)',
  completed: 'var(--status-green)',
  cancelled: 'var(--status-red)',
}

export function LaborStatusBadge({ status }: { status: LaborStatus }) {
  return <Badge color={LABOR_COLORS[status]} label={LABOR_STATUS_LABELS[status]} />
}
