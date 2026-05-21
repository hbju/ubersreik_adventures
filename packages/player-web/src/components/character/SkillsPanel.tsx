import { useState, useMemo } from 'react'
import {
  type Character,
  type Skill,
  useGameData,
  calculateSkillValue,
} from '@wfrp/shared'
import { Tabs } from '../ui/Tabs'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface SkillsPanelProps {
  character: Character
  onSkillClick?: (skillId: string, skillName: string, skillValue: number) => void
}

const SKILL_TABS = [
  { id: 'basic', label: 'Basic' },
  { id: 'advanced', label: 'Advanced' },
]

export function SkillsPanel({ character, onSkillClick }: SkillsPanelProps) {
  const { skills: allSkills } = useGameData()
  const breakpoint = useBreakpoint()
  const [activeTab, setActiveTab] = useState('basic')
  const [filter, setFilter] = useState('')

  const { basicSkills, advancedSkills } = useMemo(() => {
    const charSkills = character.skills

    // Get remaining basic skills the character doesn't have yet
    const remainingBasic: Skill[] = allSkills
      .filter(
        (skill) =>
          !charSkills.some((s) => s.id === skill.id) &&
          skill.type === 'skill' &&
          skill.classification === 'basic'
      )
      .map((skill) => ({
        id: skill.id,
        name: skill.name,
        characteristic: skill.characteristic,
        advances: 0,
        talents: 0,
        modifier: 0,
      }))

    const basic = [...charSkills, ...remainingBasic]
      .filter((skill) => {
        const def = allSkills.find((s) => s.id === skill.id)
        return def?.classification === 'basic'
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const advanced = charSkills
      .filter((skill) => {
        const def = allSkills.find((s) => s.id === skill.id)
        return def?.classification !== 'basic'
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return { basicSkills: basic, advancedSkills: advanced }
  }, [character.skills, allSkills])

  const displayedSkills = activeTab === 'basic' ? basicSkills : advancedSkills

  const filteredSkills = useMemo(() => {
    if (!filter) return displayedSkills
    const lower = filter.toLowerCase()
    return displayedSkills.filter((s) => s.name.toLowerCase().includes(lower))
  }, [displayedSkills, filter])

  return (
    <div className="wfrp-panel wfrp-grain-overlay p-3 space-y-3">
      <h3 className="font-display text-lg text-accent tracking-wide m-0">Skills</h3>

      <Tabs tabs={SKILL_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <Input
        size="sm"
        placeholder="Filter skills…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter skills"
      />

      <div className="space-y-0.5 max-h-[400px] overflow-y-auto wfrp-scrollbar">
        {filteredSkills.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            character={character}
            compact={breakpoint === 'desktop'}
            onSkillClick={onSkillClick}
          />
        ))}
        {filteredSkills.length === 0 && (
          <p className="text-sm text-muted text-center py-4">No skills match the filter.</p>
        )}
      </div>
    </div>
  )
}

interface SkillRowProps {
  skill: Skill
  character: Character
  compact: boolean
  onSkillClick?: (skillId: string, skillName: string, skillValue: number) => void
}

function SkillRow({ skill, character, compact, onSkillClick }: SkillRowProps) {
  const total = calculateSkillValue(skill, character)
  const charAbbr = skill.characteristic.toUpperCase()

  return (
    <button
      type="button"
      onClick={() => onSkillClick?.(skill.id, skill.name, total)}
      className={`
        w-full flex items-center gap-2 rounded-sm border-0 bg-transparent
        text-left transition-colors hover:bg-bg-elevated active:bg-bg-surface
        ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}
      `}
      title={`Roll ${skill.name}`}
    >
      <span
        className={`flex-1 text-accent truncate ${compact ? 'text-sm' : 'text-base'} ${
          skill.advances > 0 ? '' : 'text-secondary'
        }`}
      >
        {skill.name}
      </span>
      <Badge size="sm">{charAbbr}</Badge>
      {skill.advances > 0 && (
        <span className="text-xs text-secondary w-6 text-center">+{skill.advances}</span>
      )}
      <span className="font-display text-sm text-accent w-8 text-right tabular-nums">
        {total}
      </span>
    </button>
  )
}
