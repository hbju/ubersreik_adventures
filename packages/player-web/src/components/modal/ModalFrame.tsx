import { useEffect, useRef, type ReactNode } from 'react'
import type { ModalVariant, ModalSize } from '../../context/PlayerModalContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface ModalFrameProps {
  modalId: string
  variant: ModalVariant
  size: ModalSize
  dismissable: boolean
  onClose: () => void
  children: ReactNode
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-[400px]',
  md: 'max-w-[600px]',
  lg: 'max-w-[800px]',
  full: 'max-w-[90vw]',
}

/**
 * WFRP-styled modal container.
 * - 'modal' variant: centered panel with ornate border
 * - 'sheet' variant: slides up from bottom on mobile
 */
export function ModalFrame({ modalId, variant, size, dismissable, onClose, children }: ModalFrameProps) {
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'
  const frameRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Focus trap + restore focus on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null
    // Slight delay to let animation start
    const timer = setTimeout(() => {
      frameRef.current?.focus()
    }, 50)
    return () => {
      clearTimeout(timer)
      previousFocusRef.current?.focus()
    }
  }, [])

  // Focus trap: cycle through focusable elements
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const frame = frameRef.current
    if (!frame) return

    const focusable = frame.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // Sheet variant on mobile
  if (variant === 'sheet' && isMobile) {
    return (
      <div
        ref={frameRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`modal-title-${modalId}`}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="fixed inset-x-0 bottom-0 flex flex-col rounded-t-xl border-t-2 border-brass bg-bg-elevated shadow-deep animate-modal-slide-up max-h-[85vh]"
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2">
          <span className="h-1 w-10 rounded-full bg-brass/40" />
        </div>
        {dismissable && (
          <CloseButton onClick={onClose} className="absolute top-3 right-3" />
        )}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    )
  }

  // Modal variant (also default for sheet on desktop)
  return (
    <div
      ref={frameRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`modal-title-${modalId}`}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={`relative flex flex-col w-full mx-4 animate-modal-scale-in
        ${isMobile ? 'max-w-[calc(100vw-2rem)] max-h-[90vh]' : `${SIZE_CLASSES[size]} max-h-[85vh]`}
      `}
    >
      {/* Ornate double border: brass outer, dark inner */}
      <div className="absolute inset-0 rounded-sm border-2 border-brass pointer-events-none" />
      <div className="absolute inset-[3px] rounded-sm border border-dark pointer-events-none" />

      {/* Panel background */}
      <div className="relative flex flex-col rounded-sm bg-bg-elevated shadow-deep overflow-hidden m-[4px]">
        {dismissable && (
          <CloseButton onClick={onClose} className="absolute top-3 right-3 z-10" />
        )}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

function CloseButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-sm border border-brass/50 bg-bg-dark/80 p-0 shadow-none transition-colors hover:border-brass hover:text-brass ${className}`}
      aria-label="Close"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brass"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  )
}
