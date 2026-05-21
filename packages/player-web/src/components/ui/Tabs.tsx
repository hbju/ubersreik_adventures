import { useRef, useEffect, useState, type ReactNode } from 'react'

export interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

export interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScroll, setCanScroll] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth)
    check()
    const obs = new ResizeObserver(check)
    obs.observe(el)
    return () => obs.disconnect()
  }, [tabs])

  return (
    <div className="relative border-b border-dark">
      <div
        ref={scrollRef}
        role="tablist"
        className={`flex gap-0 overflow-x-auto wfrp-scrollbar ${canScroll ? 'pb-0.5' : ''}`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(e) => {
                const idx = tabs.findIndex((t) => t.id === tab.id)
                if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  const next = tabs[(idx + 1) % tabs.length]
                  onTabChange(next.id)
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const prev = tabs[(idx - 1 + tabs.length) % tabs.length]
                  onTabChange(prev.id)
                }
              }}
              className={`
                relative flex items-center gap-1.5 whitespace-nowrap border-0 bg-transparent px-4 py-2.5 text-sm font-display tracking-wide shadow-none transition-colors min-h-[44px]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass/50 focus-visible:ring-inset
                ${isActive
                  ? 'text-accent'
                  : 'text-muted hover:text-secondary'
                }
              `}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full bg-brass" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
