import { useEffect, type ReactNode } from 'react'

interface ModalOverlayProps {
  index: number
  dismissable: boolean
  onDismiss: () => void
  children: ReactNode
}

/**
 * Dark semi-transparent backdrop for a single modal in the stack.
 * Click-to-dismiss when allowed. Z-index increments per stacking level.
 */
export function ModalOverlay({ index, dismissable, onDismiss, children }: ModalOverlayProps) {
  const baseZ = 200
  const z = baseZ + index * 10

  // Escape key handler for topmost dismissable modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissable) {
        e.stopPropagation()
        onDismiss()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dismissable, onDismiss])

  // Prevent body scroll when modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center animate-modal-fade-in"
      style={{ zIndex: z }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 wfrp-grain-overlay"
        style={{ opacity: 0.7 + index * 0.1 }}
        onClick={dismissable ? onDismiss : undefined}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
