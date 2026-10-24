import type { ButtonHTMLAttributes, ReactNode } from 'react'
import clsx from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'accent' | 'ghost' | 'danger' | 'outline'
  loading?: boolean
}

export function Button({ children, variant = 'primary', loading, className, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-[var(--ink)] text-white hover:bg-black',
        variant === 'accent' && 'cta-pill text-[var(--ink)]',
        variant === 'outline' && 'border border-black/15 bg-white text-[var(--ink)] hover:border-black/40',
        variant === 'ghost' && 'text-[var(--ink)] hover:bg-black/[0.05]',
        variant === 'danger' && 'bg-[var(--accent)] text-white hover:brightness-105',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}
