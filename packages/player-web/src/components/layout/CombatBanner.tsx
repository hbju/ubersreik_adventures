import { usePlayerNavigation } from '../../context/PlayerNavigationContext'
import { usePlayerSession } from '../../context/PlayerSessionContext'

/**
 * Compact combat status banner.
 * Shows when combat is active; highlights in fate-gold when it's the player's turn.
 */
export function CombatBanner() {
  const { playerData } = usePlayerSession()
  const { setActiveView } = usePlayerNavigation()

  const { combatants, currentTurnId, character } = playerData

  const isCombatActive = combatants.length > 0
  if (!isCombatActive) return null

  const isMyTurn = Boolean(character?.id && currentTurnId === character.id)

  // Determine current round (approximate: turn index / combatants count)
  const currentIndex = combatants.findIndex((c) => c.id === currentTurnId)

  return (
    <button
      type="button"
      onClick={() => setActiveView('character')}
      className={`flex w-full items-center justify-center gap-2 border-0 px-3 py-1.5 text-sm font-display tracking-wide shadow-none transition-colors
        ${isMyTurn
          ? 'bg-fate/20 text-fate-light border-b border-fate animate-combat-pulse'
          : 'bg-blood/15 text-blood-light border-b border-blood'
        }
      `}
    >
      {/* Crossed swords icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
        <path d="M13 19l6-6" />
        <path d="M16 16l4 4" />
        <path d="M19 21l2-2" />
        <path d="M9.5 6.5 21 18v3h-3L6.5 9.5" />
        <path d="M11 5l-6 6" />
        <path d="M8 8 4 4" />
        <path d="M5 3 3 5" />
      </svg>

      {isMyTurn ? (
        <span className="uppercase font-bold">Your Turn</span>
      ) : (
        <span>
          Combat Active
          {currentIndex >= 0 && ` — Turn ${currentIndex + 1}/${combatants.length}`}
        </span>
      )}
    </button>
  )
}
