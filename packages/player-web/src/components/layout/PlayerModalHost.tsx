import { usePlayerModal } from '../../context/PlayerModalContext'

/**
 * Global modal host — renders the currently active modal overlay.
 * Individual modals will be wired here in future PBIs.
 */
export function PlayerModalHost() {
  const { activeModal, closeModal } = usePlayerModal()

  if (!activeModal) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={closeModal}
      />
      {/* Modal content placeholder */}
      <div className="relative z-10 wfrp-panel-elevated wfrp-border-ornate max-w-lg w-full mx-4 p-6">
        <p className="text-secondary text-sm mb-0">
          Modal: <span className="text-accent">{activeModal}</span>
        </p>
        <button
          type="button"
          className="mt-4"
          onClick={closeModal}
        >
          Close
        </button>
      </div>
    </div>
  )
}
