import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

export type ModalVariant = 'modal' | 'sheet'
export type ModalSize = 'sm' | 'md' | 'lg' | 'full'

export interface ModalOptions {
  dismissable?: boolean
  variant?: ModalVariant
  size?: ModalSize
}

export interface ModalEntry {
  id: string
  component: ReactNode
  options: ModalOptions
}

export interface PlayerModalContextValue {
  openModals: ModalEntry[]
  openModal: (id: string, component: ReactNode, options?: ModalOptions) => void
  closeModal: (id: string) => void
  closeAllModals: () => void
}

const PlayerModalContext = createContext<PlayerModalContextValue | null>(null)

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [openModals, setOpenModals] = useState<ModalEntry[]>([])

  const openModal = useCallback((id: string, component: ReactNode, options?: ModalOptions) => {
    setOpenModals((prev) => {
      // Replace if same id already open
      const filtered = prev.filter((m) => m.id !== id)
      return [...filtered, { id, component, options: { dismissable: true, variant: 'modal', size: 'md', ...options } }]
    })
  }, [])

  const closeModal = useCallback((id: string) => {
    setOpenModals((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const closeAllModals = useCallback(() => {
    setOpenModals([])
  }, [])

  return (
    <PlayerModalContext.Provider value={{ openModals, openModal, closeModal, closeAllModals }}>
      {children}
    </PlayerModalContext.Provider>
  )
}

export function usePlayerModal(): PlayerModalContextValue {
  const ctx = useContext(PlayerModalContext)
  if (!ctx) {
    throw new Error('usePlayerModal must be used within PlayerModalProvider')
  }
  return ctx
}
