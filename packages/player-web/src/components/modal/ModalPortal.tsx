import { createPortal } from 'react-dom'
import { usePlayerModal } from '../../context/PlayerModalContext'
import { ModalOverlay } from './ModalOverlay'
import { ModalFrame } from './ModalFrame'

/**
 * Renders all open modals from context into a React portal.
 * Each modal is stacked with increasing z-index.
 */
export function ModalPortal() {
  const { openModals, closeModal } = usePlayerModal()

  if (openModals.length === 0) return null

  return createPortal(
    <>
      {openModals.map((entry, index) => (
        <ModalOverlay
          key={entry.id}
          index={index}
          dismissable={entry.options.dismissable ?? true}
          onDismiss={() => closeModal(entry.id)}
        >
          <ModalFrame
            modalId={entry.id}
            variant={entry.options.variant ?? 'modal'}
            size={entry.options.size ?? 'md'}
            dismissable={entry.options.dismissable ?? true}
            onClose={() => closeModal(entry.id)}
          >
            {entry.component}
          </ModalFrame>
        </ModalOverlay>
      ))}
    </>,
    document.body
  )
}
