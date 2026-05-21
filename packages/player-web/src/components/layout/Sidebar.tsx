import { useEffect } from 'react'
import { usePlayerNavigation, type PlayerView } from '../../context/PlayerNavigationContext'
import { NavBadge } from './NavBadge'

const COLLAPSED_KEY = 'wfrp-sidebar-collapsed'

interface NavItem {
  id: PlayerView
  label: string
  icon: React.ReactNode
}

function PersonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  )
}

function CoinsIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" />
      <path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  )
}

function BookOpenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
    >
      <path d="m11 17-5-5 5-5" />
      <path d="m18 17-5-5 5-5" />
    </svg>
  )
}

const NAV_ITEMS: NavItem[] = [
  { id: 'character', label: 'Character', icon: <PersonIcon /> },
  { id: 'map', label: 'Map', icon: <MapIcon /> },
  { id: 'journal', label: 'Journal & Quests', icon: <BookIcon /> },
  { id: 'chat', label: 'Chat', icon: <MessageIcon /> },
  { id: 'shops', label: 'Shops', icon: <CoinsIcon /> },
  { id: 'codex', label: 'Codex', icon: <BookOpenIcon /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
]

export type NavBadges = Partial<Record<PlayerView, number | 'dot'>>

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  badges?: NavBadges
}

export function Sidebar({ collapsed, onToggleCollapse, badges = {} }: SidebarProps) {
  const { activeView, setActiveView } = usePlayerNavigation()

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed))
  }, [collapsed])

  const width = collapsed ? 'w-14' : 'w-[220px]'

  return (
    <aside
      className={`fixed top-14 left-0 bottom-0 z-30 flex flex-col border-r border-dark bg-bg-dark transition-[width] duration-200 ease-in-out ${width}`}
    >
      <nav className="flex-1 overflow-y-auto py-2 wfrp-scrollbar">
        <ul className="flex flex-col gap-0.5 px-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded-sm border-0 px-3 py-2.5 text-left text-sm font-body shadow-none transition-colors duration-150
                    ${isActive
                      ? 'bg-bg-elevated text-accent border-l-2 border-l-brass-solid'
                      : 'bg-transparent text-secondary hover:bg-bg-panel hover:text-primary'
                    }
                    ${collapsed ? 'justify-center px-0' : ''}
                  `}
                >
                  <span className={`relative shrink-0 ${isActive ? 'text-accent' : ''}`}>
                    {item.icon}
                    {badges[item.id] != null && <NavBadge value={badges[item.id]!} />}
                  </span>
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-dark p-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center rounded-sm border-0 bg-transparent p-2 text-secondary shadow-none hover:text-accent"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>
    </aside>
  )
}

export { NAV_ITEMS }
export type { NavItem }
