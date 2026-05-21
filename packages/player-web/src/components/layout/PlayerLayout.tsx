import { useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { ViewContainer } from './ViewContainer'

const COLLAPSED_KEY = 'wfrp-sidebar-collapsed'
const HEADER_HEIGHT = '3.5rem'            // 56px
const BOTTOM_NAV_HEIGHT = 'calc(64px + env(safe-area-inset-bottom, 0px))'

export function PlayerLayout() {
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'
  const isTablet = breakpoint === 'tablet'

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    if (stored !== null) return stored === 'true'
    // Tablet defaults collapsed, desktop expanded
    return isTablet
  })

  const sidebarWidth = sidebarCollapsed ? '3.5rem' : '220px'

  return (
    <div className="wfrp-dark wfrp-grain-overlay flex min-h-screen w-full flex-col">
      <Header />

      <div className="flex flex-1" style={{ paddingTop: HEADER_HEIGHT }}>
        {/* Sidebar for tablet + desktop */}
        {!isMobile && (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          />
        )}

        {/* Main content area */}
        <div
          className="flex flex-1 flex-col transition-[margin] duration-200 ease-in-out"
          style={{
            marginLeft: isMobile ? 0 : sidebarWidth,
            paddingBottom: isMobile ? BOTTOM_NAV_HEIGHT : 0,
          }}
        >
          <ViewContainer />
        </div>
      </div>

      {/* Bottom nav for mobile */}
      {isMobile && <BottomNav />}
    </div>
  )
}
