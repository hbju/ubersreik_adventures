export type DividerVariant = 'subtle' | 'ornate' | 'section'
export type DividerDirection = 'horizontal' | 'vertical'

export interface DividerProps {
  variant?: DividerVariant
  direction?: DividerDirection
  label?: string
  className?: string
}

const HORIZONTAL_CLASSES: Record<DividerVariant, string> = {
  subtle: 'border-t border-dark/60',
  ornate: 'border-t border-brass/50',
  section: 'border-t-2 border-brass/40',
}

const VERTICAL_CLASSES: Record<DividerVariant, string> = {
  subtle: 'border-l border-dark/60 self-stretch',
  ornate: 'border-l border-brass/50 self-stretch',
  section: 'border-l-2 border-brass/40 self-stretch',
}

export function Divider({ variant = 'subtle', direction = 'horizontal', label, className = '' }: DividerProps) {
  if (direction === 'vertical') {
    return <div className={`${VERTICAL_CLASSES[variant]} ${className}`} role="separator" aria-orientation="vertical" />
  }

  if (label && variant === 'section') {
    return (
      <div className={`flex items-center gap-3 ${className}`} role="separator">
        <span className="flex-1 border-t-2 border-brass/40" />
        <span className="text-xs font-display text-muted uppercase tracking-wider shrink-0">{label}</span>
        <span className="flex-1 border-t-2 border-brass/40" />
      </div>
    )
  }

  return <hr className={`w-full m-0 ${HORIZONTAL_CLASSES[variant]} ${className}`} role="separator" />
}
