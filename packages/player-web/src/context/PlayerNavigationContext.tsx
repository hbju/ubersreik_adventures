import { createContext, useContext, useState, type ReactNode } from 'react'

export type PlayerView =
  | 'character'
  | 'map'
  | 'journal'
  | 'chat'
  | 'shops'
  | 'codex'
  | 'calendar'

export interface PlayerNavigationContextValue {
  activeView: PlayerView
  setActiveView: (view: PlayerView) => void
}

const PlayerNavigationContext = createContext<PlayerNavigationContextValue | null>(null)

export function PlayerNavigationProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<PlayerView>('character')

  return (
    <PlayerNavigationContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </PlayerNavigationContext.Provider>
  )
}

export function usePlayerNavigation(): PlayerNavigationContextValue {
  const ctx = useContext(PlayerNavigationContext)
  if (!ctx) {
    throw new Error('usePlayerNavigation must be used within PlayerNavigationProvider')
  }
  return ctx
}
