import { type Character, type Career, useGameData } from '@wfrp/shared'
import { Badge } from '../ui/Badge'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface CharacterHeaderProps {
  character: Character
}

export function CharacterHeader({ character }: CharacterHeaderProps) {
  const { careers } = useGameData()
  const breakpoint = useBreakpoint()

  const career = careers.find((c: Career) => c.id === character.currentCareerId)
  const careerLevel = career?.career_level.find(
    (lvl) => lvl.id === character.currentCareerLevelId
  )

  const totalXp = character.xp.current + character.xp.spent
  const xpPercent = totalXp > 0 ? (character.xp.spent / totalXp) * 100 : 0

  if (breakpoint === 'mobile') {
    return (
      <div className="wfrp-panel wfrp-grain-overlay p-4 space-y-3">
        <h1 className="font-display text-2xl text-accent tracking-wide m-0 leading-tight">
          {character.name}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Badge>{character.species}</Badge>
          {character.class && <Badge variant="info">{character.class}</Badge>}
        </div>
        <div className="text-sm text-primary">
          <span className="text-secondary">Career: </span>
          <span className="font-display tracking-wide">
            {career?.name ?? '—'}
          </span>
          {careerLevel && (
            <span className="text-secondary ml-2">({careerLevel.name})</span>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-secondary">
            <span>XP</span>
            <span>
              {character.xp.current} available / {totalXp} total
            </span>
          </div>
          <div className="h-1.5 rounded-sm bg-bg-dark overflow-hidden">
            <div
              className="h-full bg-brass transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="wfrp-panel wfrp-grain-overlay p-4 flex items-center gap-6 flex-wrap">
      <h1 className="font-display text-3xl text-accent tracking-wide m-0 leading-tight">
        {character.name}
      </h1>
      <div className="flex items-center gap-2">
        <Badge>{character.species}</Badge>
        {character.class && <Badge variant="info">{character.class}</Badge>}
      </div>
      <div className="flex items-center gap-2 text-sm text-primary">
        <span className="text-secondary">Career:</span>
        <span className="font-display tracking-wide">
          {career?.name ?? '—'}
        </span>
        {careerLevel && (
          <span className="text-secondary">({careerLevel.name})</span>
        )}
      </div>
      <div className="ml-auto flex items-center gap-3 min-w-[180px]">
        <span className="text-xs text-secondary whitespace-nowrap">
          XP: {character.xp.current} / {totalXp}
        </span>
        <div className="flex-1 h-1.5 rounded-sm bg-bg-dark overflow-hidden">
          <div
            className="h-full bg-brass transition-all duration-300"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}
