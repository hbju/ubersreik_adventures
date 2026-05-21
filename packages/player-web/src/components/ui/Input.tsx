import { forwardRef, useId, type InputHTMLAttributes } from 'react'

export type InputSize = 'sm' | 'md'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize
  label?: string
  helperText?: string
  error?: string
}

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-sm min-h-[36px]',
  md: 'px-3 py-2 text-base min-h-[44px]',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', label, helperText, error, className = '', id: propId, ...props }, ref) => {
    const autoId = useId()
    const id = propId ?? autoId
    const errorId = `${id}-error`
    const helperId = `${id}-helper`

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-display text-secondary tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`
            w-full rounded-sm border bg-bg-dark text-primary placeholder:text-muted
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass focus:bg-bg-elevated
            disabled:cursor-not-allowed disabled:opacity-50
            ${error
              ? 'border-blood focus:ring-blood/50 focus:border-blood'
              : 'border-dark hover:border-brass/50'
            }
            ${SIZE_CLASSES[size]}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-blood-light mb-0" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-muted mb-0">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
