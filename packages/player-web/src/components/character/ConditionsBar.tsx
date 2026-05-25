import type { Condition, Combatant } from '@wfrp/shared'
import { checkConditionEffects } from '@wfrp/shared'
import { Badge, type BadgeVariant } from '../ui/Badge'
import { usePlayerModal } from '../../context/PlayerModalContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'

const CONDITION_VARIANT: Record<string, BadgeVariant> = {
  condition_ablaze: 'danger',
  condition_bleeding: 'danger',
  condition_poisoned: 'danger',
  condition_unconscious: 'danger',
  condition_broken: 'danger',
  condition_stunned: 'default',
  condition_entangled: 'default',
  condition_fatigued: 'default',
  condition_prone: 'default',
  condition_blinded: 'info',
  condition_deafened: 'info',
  condition_surprised: 'info',
}

function ConditionDetail({
  condition,
  onClose,
}: {
  condition: Condition
  onClose: () => void
}) {
  const mockCombatant = {
    conditions: Array<string>(condition.stack).fill(condition.id),
  } as unknown as Combatant
  const effects = checkConditionEffects(condition.id, mockCombatant)

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg text-accent leading-tight">{condition.name}</h3>
        <Badge variant={CONDITION_VARIANT[condition.id] ?? 'default'} size="md">
          ×{condition.stack}
        </Badge>
      </div>

      <p className="text-sm text-primary font-body leading-relaxed">{effects.description}</p>

      {condition.description && condition.description !== effects.description && (
        <p className="text-xs text-secondary font-body leading-relaxed border-t border-subtle pt-3">
          {condition.description}
        </p>
      )}

      <button
        className="w-full text-center text-xs text-secondary hover:text-primary transition-colors pt-1"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  )
}

interface ConditionsBarProps {
  conditions: Condition[]
}

export function ConditionsBar({ conditions }: ConditionsBarProps) {
  const { openModal, closeModal } = usePlayerModal()
  const breakpoint = useBreakpoint()

  if (conditions.length === 0) return null

  const handleClick = (condition: Condition) => {
    const modalId = `condition-${condition.id}`
    openModal(
      modalId,
      <ConditionDetail condition={condition} onClose={() => closeModal(modalId)} />,
      {
        variant: breakpoint === 'mobile' ? 'sheet' : 'modal',
        size: 'sm',
      }
    )
  }

  return (
    <div className="wfrp-panel wfrp-grain-overlay px-3 py-2">
      <p className="text-[10px] font-display tracking-widest text-secondary uppercase mb-2">
        Conditions
      </p>
      <div
        className={
          breakpoint === 'mobile'
            ? 'flex flex-row gap-2 overflow-x-auto pb-0.5'
            : 'flex flex-wrap gap-2'
        }
      >
        {conditions.map((condition) => (
          <button
            key={condition.id}
            onClick={() => handleClick(condition)}
            className="shrink-0 focus:outline-none transition-opacity hover:opacity-80 active:opacity-60"
          >
            <Badge variant={CONDITION_VARIANT[condition.id] ?? 'default'} size="md">
              {condition.name}
              {condition.stack > 1 && (
                <span className="opacity-75 ml-0.5">×{condition.stack}</span>
              )}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
