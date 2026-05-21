import { useState } from 'react'
import { usePlayerNavigation, type PlayerView } from '../../context/PlayerNavigationContext'
import { NavBadge } from './NavBadge'
import type { NavBadges } from './Sidebar'

interface TabDef {
  id: PlayerView | 'more'
  label: string
  icon: React.ReactNode
}

function PersonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z" />
      <path d="M15 5.764v15" />
      <path d="M9 3.236v15" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
    </svg>
  )
}

function MessageIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
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

const PRIMARY_TABS: TabDef[] = [
  { id: 'character', label: 'Character', icon: <PersonIcon /> },
  { id: 'map', label: 'Map', icon: <MapIcon /> },
  { id: 'journal', label: 'Journal', icon: <BookIcon /> },
  { id: 'chat', label: 'Chat', icon: <MessageIcon /> },
  { id: 'more', label: 'More', icon: <MoreIcon /> },
]

const MORE_ITEMS: { id: PlayerView; label: string; icon: React.ReactNode }[] = [
  { id: 'shops', label: 'Shops', icon: <CoinsIcon /> },
  { id: 'codex', label: 'Codex', icon: <BookOpenIcon /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarIcon /> },
]

export function BottomNav({ badges = {} }: { badges?: NavBadges }) {
  const { activeView, setActiveView } = usePlayerNavigation()
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = MORE_ITEMS.some((item) => item.id === activeView)

  function handleTabClick(id: PlayerView | 'more') {
    if (id === 'more') {
      setMoreOpen((v) => !v)
    } else {
      setActiveView(id)
      setMoreOpen(false)
    }
  }

  function handleMoreItemClick(id: PlayerView) {
    setActiveView(id)
    setMoreOpen(false)
  }

  return (
    <>
      {/* "More" slide-up drawer backdrop */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* "More" slide-up drawer */}
      <div
        className={`fixed left-0 right-0 z-50 rounded-t-lg border-t border-brass bg-bg-dark px-4 pb-2 pt-4 transition-transform duration-200 ease-out ${
          moreOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
      >
        <ul className="flex flex-col gap-1">
          {MORE_ITEMS.map((item) => {
            const isActive = activeView === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleMoreItemClick(item.id)}
                  className={`flex w-full items-center gap-3 rounded-sm border-0 px-3 py-3 text-left text-base font-body shadow-none transition-colors
                    ${isActive ? 'bg-bg-elevated text-accent' : 'bg-transparent text-primary hover:bg-bg-panel'}
                  `}
                >
                  <span className={isActive ? 'text-accent' : 'text-secondary'}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-dark bg-bg-dark"
        style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {PRIMARY_TABS.map((tab) => {
          const isActive = tab.id === 'more'
            ? isMoreActive || moreOpen
            : activeView === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent py-2 shadow-none transition-colors
                ${isActive ? 'text-accent' : 'text-secondary'}
              `}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-brass" />
              )}
              <span className="relative">
                {tab.icon}
                {tab.id !== 'more' && badges[tab.id as PlayerView] != null && (
                  <NavBadge value={badges[tab.id as PlayerView]!} />
                )}
              </span>
              <span className="text-[10px] leading-tight">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
