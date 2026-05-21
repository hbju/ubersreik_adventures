import type { ReactNode } from 'react'

interface ModalHeaderProps {
  title: string
  subtitle?: string
  children?: ReactNode
}

export function ModalHeader({ title, subtitle, children }: ModalHeaderProps) {
  return (
    <div className="border-b border-brass/30 px-6 pt-5 pb-4">
      <h2 className="mb-0 font-display text-lg text-accent tracking-wide">{title}</h2>
      {subtitle && <p className="mt-1 mb-0 text-sm text-secondary">{subtitle}</p>}
      {children}
    </div>
  )
}

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`flex-1 overflow-y-auto px-6 py-4 ${className}`}>
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`border-t border-brass/30 px-6 py-4 flex items-center justify-end gap-3 ${className}`}>
      {children}
    </div>
  )
}
