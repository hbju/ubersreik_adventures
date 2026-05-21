import { forwardRef, useId, useRef, useEffect, type TextareaHTMLAttributes } from 'react'

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
  autoGrow?: boolean
  maxLength?: number
  showCount?: boolean
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, helperText, error, autoGrow = false, maxLength, showCount = false, className = '', id: propId, value, onChange, ...props }, ref) => {
    const autoId = useId()
    const id = propId ?? autoId
    const errorId = `${id}-error`
    const helperId = `${id}-helper`
    const internalRef = useRef<HTMLTextAreaElement | null>(null)

    // Auto-grow logic
    useEffect(() => {
      if (!autoGrow) return
      const el = internalRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }, [autoGrow, value])

    const charCount = typeof value === 'string' ? value.length : 0

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-display text-secondary tracking-wide">
            {label}
          </label>
        )}
        <textarea
          ref={(el) => {
            internalRef.current = el
            if (typeof ref === 'function') ref(el)
            else if (ref) ref.current = el
          }}
          id={id}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={`
            w-full rounded-sm border bg-bg-dark text-primary placeholder:text-muted
            transition-all duration-150 min-h-[88px] px-3 py-2 text-base resize-y
            focus:outline-none focus:ring-2 focus:ring-brass/50 focus:border-brass focus:bg-bg-elevated
            disabled:cursor-not-allowed disabled:opacity-50
            ${autoGrow ? 'resize-none overflow-hidden' : ''}
            ${error
              ? 'border-blood focus:ring-blood/50 focus:border-blood'
              : 'border-dark hover:border-brass/50'
            }
            ${className}
          `}
          {...props}
        />
        <div className="flex items-center justify-between">
          <div>
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
          {showCount && maxLength && (
            <p className={`text-xs mb-0 ${charCount >= maxLength ? 'text-blood-light' : 'text-muted'}`}>
              {charCount}/{maxLength}
            </p>
          )}
        </div>
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'
