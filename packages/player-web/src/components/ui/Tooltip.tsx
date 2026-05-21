import { useState, useRef, useEffect, type ReactNode } from 'react'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps {
  content: ReactNode
  position?: TooltipPosition
  delay?: number
  children: ReactNode
}

export function Tooltip({ content, position = 'top', delay = 300, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [actualPos, setActualPos] = useState(position)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay)
  }

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  // Adjust position if tooltip would clip viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current || !triggerRef.current) return
    const tooltip = tooltipRef.current.getBoundingClientRect()
    const trigger = triggerRef.current.getBoundingClientRect()
    let resolved = position

    if (position === 'top' && trigger.top - tooltip.height < 8) resolved = 'bottom'
    else if (position === 'bottom' && trigger.bottom + tooltip.height > window.innerHeight - 8) resolved = 'top'
    else if (position === 'left' && trigger.left - tooltip.width < 8) resolved = 'right'
    else if (position === 'right' && trigger.right + tooltip.width > window.innerWidth - 8) resolved = 'left'

    setActualPos(resolved)
  }, [visible, position])

  const positionClasses: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-bg-elevated border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-bg-elevated border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-bg-elevated border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-bg-elevated border-y-transparent border-l-transparent',
  }

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-[300] pointer-events-none whitespace-nowrap rounded-sm border border-brass/60 bg-bg-elevated px-2.5 py-1.5 text-xs text-primary shadow-elevated animate-modal-fade-in ${positionClasses[actualPos]}`}
        >
          {content}
          <span className={`absolute h-0 w-0 border-4 ${arrowClasses[actualPos]}`} />
        </div>
      )}
    </span>
  )
}
