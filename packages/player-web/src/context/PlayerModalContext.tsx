import { createContext, useContext, useCallback, useState, type ReactNode } from 'react'

export interface PlayerModalContextValue {
  activeModal: string | null
  modalProps: Record<string, unknown>
  openModal: (id: string, props?: Record<string, unknown>) => void
  closeModal: () => void
}

const PlayerModalContext = createContext<PlayerModalContextValue | null>(null)

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [modalProps, setModalProps] = useState<Record<string, unknown>>({})

  const openModal = useCallback((id: string, props?: Record<string, unknown>) => {
    setActiveModal(id)
    setModalProps(props ?? {})
  }, [])

  const closeModal = useCallback(() => {
    setActiveModal(null)
    setModalProps({})
  }, [])

  return (
    <PlayerModalContext.Provider value={{ activeModal, modalProps, openModal, closeModal }}>
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
