import { useCallback, type ReactNode } from 'react'
import { usePlayerModal, type ModalOptions } from '../context/PlayerModalContext'

/**
 * Convenience hook for managing a specific named modal.
 *
 * Usage:
 *   const { open, close } = useModal('confirm-delete')
 *   open(<ConfirmDialog />, { size: 'sm' })
 */
export function useModal(id: string) {
  const { openModal, closeModal } = usePlayerModal()

  const open = useCallback(
    (component: ReactNode, options?: ModalOptions) => {
      openModal(id, component, options)
    },
    [id, openModal]
  )

  const close = useCallback(() => {
    closeModal(id)
  }, [id, closeModal])

  return { open, close }
}
