import type { ReactNode } from 'react'

export type BadgeVariant = 'default' | 'success' | 'danger' | 'magic' | 'info'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  onDismiss?: () => void
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-brass/20 text-brass-light border-brass/40',
  success: 'bg-poison/15 text-poison-light border-poison/30',
  danger: 'bg-blood/20 text-blood-light border-blood/40',
  magic: 'bg-magic/15 text-magic-light border-magic/30',
  info: 'bg-iron/20 text-iron border-iron/30',
}

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
}

export function Badge({ children, variant = 'default', size = 'md', onDismiss }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border font-display tracking-wide leading-tight
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
      `}
    >
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-0 bg-transparent p-0 opacity-60 shadow-none transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
