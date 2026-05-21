import { type Character, CharacteristicsTable } from '@wfrp/shared'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface CharacteristicsGridProps {
  character: Character
  onCharacteristicClick?: (charId: string, charName: string, charValue: number) => void
}

/**
 * Responsive wrapper around the shared CharacteristicsTable.
 * - Desktop: single row of 10 columns (default table)
 * - Tablet/Mobile: horizontal scroll to keep the table compact
 */
export function CharacteristicsGrid({
  character,
  onCharacteristicClick,
}: CharacteristicsGridProps) {
  const breakpoint = useBreakpoint()

  return (
    <div
      className={`wfrp-panel wfrp-border-ornate wfrp-grain-overlay ${
        breakpoint === 'mobile' ? 'p-2 overflow-x-auto' : 'p-4'
      }`}
    >
      <div className={breakpoint === 'mobile' ? 'min-w-[600px]' : ''}>
        <CharacteristicsTable
          character={character}
          isEditMode={false}
          onCharacterUpdate={() => {}}
          onCharacteristicClick={onCharacteristicClick}
        />
      </div>
    </div>
  )
}
