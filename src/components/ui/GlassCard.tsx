import type { HTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  strong?: boolean
}

export function GlassCard({ children, strong, className, ...rest }: GlassCardProps) {
  return (
    <div
      className={clsx(strong ? 'glass-strong' : 'glass', 'rounded-3xl', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
