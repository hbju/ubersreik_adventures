import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brass text-bg-deepest border-brass hover:bg-brass-light hover:shadow-glow-brass active:bg-brass-dark disabled:bg-brass/40 disabled:text-bg-deepest/60',
  secondary:
    'bg-transparent text-brass border-brass hover:bg-brass/10 hover:shadow-glow-brass active:bg-brass/20 disabled:border-brass/40 disabled:text-brass/40',
  danger:
    'bg-blood text-white border-blood hover:bg-blood-light active:bg-blood/80 disabled:bg-blood/40 disabled:text-white/60',
  ghost:
    'bg-transparent text-secondary border-transparent hover:text-accent hover:bg-white/5 active:bg-white/10 disabled:text-muted',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px]',
  lg: 'px-6 py-2.5 text-base min-h-[48px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, iconLeft, iconRight, children, className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center gap-2 rounded-sm border font-display tracking-wide
          transition-all duration-150 ease-in-out
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-dark
          disabled:cursor-not-allowed disabled:shadow-none
          ${VARIANT_CLASSES[variant]}
          ${SIZE_CLASSES[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Spinner size={size} />
        ) : (
          <>
            {iconLeft && <span className="shrink-0">{iconLeft}</span>}
            {children}
            {iconRight && <span className="shrink-0">{iconRight}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

function Spinner({ size }: { size: ButtonSize }) {
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <svg className={`animate-spin ${dim}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
