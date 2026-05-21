import { useMemo } from 'react'
import { type Character, type Talent, useGameData } from '@wfrp/shared'
import { usePlayerModal } from '../../context/PlayerModalContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Badge } from '../ui/Badge'

interface TalentsPanelProps {
  character: Character
}

export function TalentsPanel({ character }: TalentsPanelProps) {
  const { talents: allTalents } = useGameData()
  const { openModal, closeModal } = usePlayerModal()
  const breakpoint = useBreakpoint()

  const characterTalents = useMemo(() => {
    return Object.entries(character.talents)
      .filter(([, rank]) => rank > 0)
      .map(([talentId, rank]) => {
        const def = allTalents.find((t: Talent) => t.id === talentId)
        return { talentId, rank, def }
      })
      .filter((t) => t.def != null)
      .sort((a, b) => a.def!.name.localeCompare(b.def!.name))
  }, [character.talents, allTalents])

  const handleTalentClick = (talent: Talent, rank: number) => {
    openModal(
      'talent-detail',
      <TalentDetailContent
        talent={talent}
        rank={rank}
        onClose={() => closeModal('talent-detail')}
      />,
      {
        variant: breakpoint === 'mobile' ? 'sheet' : 'modal',
        size: 'sm',
      }
    )
  }

  if (characterTalents.length === 0) {
    return (
      <div className="wfrp-panel wfrp-grain-overlay p-3">
        <h3 className="font-display text-lg text-accent tracking-wide m-0 mb-3">Talents</h3>
        <p className="text-sm text-muted text-center py-4">No talents acquired yet.</p>
      </div>
    )
  }

  const isDesktop = breakpoint === 'desktop'

  return (
    <div className="wfrp-panel wfrp-grain-overlay p-3">
      <h3 className="font-display text-lg text-accent tracking-wide m-0 mb-3">Talents</h3>
      <div
        className={`gap-2 max-h-[400px] overflow-y-auto wfrp-scrollbar ${
          isDesktop ? 'grid grid-cols-2' : 'flex flex-col'
        }`}
      >
        {characterTalents.map(({ talentId, rank, def }) => (
          <button
            key={talentId}
            type="button"
            onClick={() => handleTalentClick(def!, rank)}
            className="w-full text-left rounded-sm border border-border-dark bg-bg-dark
              px-3 py-2 transition-colors hover:border-brass/50 hover:bg-bg-elevated
              active:bg-bg-surface"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-primary flex-1 truncate">{def!.name}</span>
              {rank > 1 && <Badge size="sm">×{rank}</Badge>}
            </div>
            {def!.description && (
              <p className="text-xs text-secondary mt-1 mb-0 line-clamp-2">
                {def!.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Talent Detail Modal Content ────────────────────────────────────────────

interface TalentDetailContentProps {
  talent: Talent
  rank: number
  onClose: () => void
}

function TalentDetailContent({ talent, rank, onClose }: TalentDetailContentProps) {
  return (
    <div className="space-y-4 p-4  max-w-sm mx-auto">
      <div>
        <h2
          id="modal-title-talent-detail"
          className="font-display text-xl text-accent tracking-wide m-0"
        >
          {talent.name}
          {rank > 1 && <span className="text-secondary ml-2">×{rank}</span>}
        </h2>
        <p className="text-xs text-muted mt-1">
          Max Ranks: {talent.max_ranks}
        </p>
      </div>

      <p className="text-sm text-primary leading-relaxed">{talent.description}</p>

      {talent.tests && talent.tests.length > 0 && (
        <div>
          <p className="text-xs text-secondary font-display tracking-wide mb-1">Tests</p>
          <div className="flex flex-wrap gap-1">
            {talent.tests.map((test) => (
              <Badge key={test} size="sm" variant="info">
                {test}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {talent.effects && talent.effects.length > 0 && (
        <div>
          <p className="text-xs text-secondary font-display tracking-wide mb-1">Effects</p>
          <ul className="list-none m-0 p-0 space-y-1">
            {talent.effects.map((effect, i) => (
              <li
                key={i}
                className="text-xs text-primary bg-bg-dark border border-border-dark rounded-sm px-2 py-1.5"
              >
                <span className="text-brass font-display">{formatEffectType(effect.type)}</span>
                {effect.value != null && (
                  <span className="text-secondary ml-1">({String(effect.value)})</span>
                )}
                {effect.appliesTo && effect.appliesTo.length > 0 && (
                  <span className="text-muted ml-1">→ {effect.appliesTo.join(', ')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        className="w-full py-2.5 px-4 rounded-sm font-display tracking-wide text-sm
          bg-bg-dark text-secondary border border-border-dark
          hover:text-primary hover:border-border-subtle transition-colors"
      >
        Close
      </button>
    </div>
  )
}

function formatEffectType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
