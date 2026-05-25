import { useState, useEffect, useCallback } from 'react'
import type { Character } from '@wfrp/shared'
import { useBreakpoint } from '../../hooks/useBreakpoint'

interface StatusBarProps {
  character: Character
  onUpdate: (partial: Partial<Character>) => Promise<void>
}

type SpendableResource = 'fortune' | 'resolve'

function ProgressBar({ fill, color }: { fill: number; color: 'brass' | 'poison' }) {
  return (
    <div className="h-1 w-full rounded-full bg-bg-dark overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${color === 'brass' ? 'bg-brass' : 'bg-poison'}`}
        style={{ width: `${Math.max(0, Math.min(100, fill * 100))}%` }}
      />
    </div>
  )
}

interface ResourceCardProps {
  label: string
  current: number
  max?: number
  hasBar?: boolean
  barColor?: 'brass' | 'poison'
  barFill?: number
  spendable?: boolean
  pending?: boolean
  onSpendTap?: () => void
}

function ResourceCard({
  label,
  current,
  max,
  hasBar,
  barColor = 'brass',
  barFill = 0,
  spendable,
  pending,
  onSpendTap,
}: ResourceCardProps) {
  const isClickable = spendable && current > 0

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onSpendTap : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onSpendTap?.() : undefined}
      className={[
        'flex flex-col items-center gap-1 rounded-sm border px-2 py-2 select-none min-h-[72px] justify-between',
        pending ? 'border-brass/60 bg-brass/10' : 'border-subtle bg-bg-dark/30',
        isClickable ? 'cursor-pointer transition-colors active:bg-brass/15 focus:outline-none focus:ring-1 focus:ring-brass/40' : '',
      ].join(' ')}
    >
      <span className="text-[9px] font-display tracking-widest text-secondary uppercase leading-none">
        {label}
      </span>

      <div className="flex items-baseline gap-0.5">
        <span className={`text-2xl font-display leading-none ${pending ? 'text-brass' : 'text-accent'}`}>
          {current}
        </span>
        {max !== undefined && (
          <span className="text-[10px] text-muted leading-none">/{max}</span>
        )}
      </div>

      {hasBar ? (
        <ProgressBar fill={barFill} color={barColor} />
      ) : (
        <div className="h-1 w-full" />
      )}

      {pending && (
        <span className="text-[9px] text-brass font-display tracking-wider animate-pulse">
          Spend?
        </span>
      )}
    </div>
  )
}

function CurrencyRow({ gc, ss, bp }: { gc: number; ss: number; bp: number }) {
  return (
    <div className="flex items-center justify-center gap-3 pt-2 border-t border-subtle">
      <span className="flex items-baseline gap-1">
        <span className="font-display text-sm text-brass leading-none">{gc}</span>
        <span className="text-[10px] text-secondary font-display tracking-wider">GC</span>
      </span>
      <span className="text-muted text-xs">·</span>
      <span className="flex items-baseline gap-1">
        <span className="font-display text-sm text-iron leading-none">{ss}</span>
        <span className="text-[10px] text-secondary font-display tracking-wider">SS</span>
      </span>
      <span className="text-muted text-xs">·</span>
      <span className="flex items-baseline gap-1">
        <span className="font-display text-sm text-copper leading-none">{bp}</span>
        <span className="text-[10px] text-secondary font-display tracking-wider">BP</span>
      </span>
    </div>
  )
}

export function StatusBar({ character, onUpdate }: StatusBarProps) {
  const breakpoint = useBreakpoint()
  const [pending, setPending] = useState<SpendableResource | null>(null)

  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setPending(null), 2500)
    return () => clearTimeout(t)
  }, [pending])

  const handleSpendTap = useCallback(
    async (resource: SpendableResource) => {
      if (pending === resource) {
        const current = character.status[resource].current
        if (current > 0) {
          await onUpdate({
            status: {
              ...character.status,
              [resource]: { ...character.status[resource], current: current - 1 },
            },
          })
        }
        setPending(null)
      } else {
        setPending(resource)
      }
    },
    [pending, character.status, onUpdate]
  )

  const { wounds, fate, fortune, resilience, resolve, corruption } = character.status
  const { gc, ss, bp } = character.currency

  return (
    <div className="wfrp-panel wfrp-grain-overlay p-3 space-y-2">
      <div className={breakpoint === 'mobile' ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-6 gap-2'}>
        <ResourceCard
          label="Wounds"
          current={wounds.current}
          max={wounds.max}
          hasBar
          barColor="brass"
          barFill={wounds.max > 0 ? wounds.current / wounds.max : 0}
        />
        <ResourceCard label="Fate" current={fate.current} />
        <ResourceCard
          label="Fortune"
          current={fortune.current}
          max={fate.current}
          spendable
          pending={pending === 'fortune'}
          onSpendTap={() => void handleSpendTap('fortune')}
        />
        <ResourceCard label="Resilience" current={resilience.current} />
        <ResourceCard
          label="Resolve"
          current={resolve.current}
          max={resilience.current}
          spendable
          pending={pending === 'resolve'}
          onSpendTap={() => void handleSpendTap('resolve')}
        />
        <ResourceCard
          label="Corruption"
          current={corruption.current}
          max={corruption.max}
          hasBar
          barColor="poison"
          barFill={corruption.max > 0 ? corruption.current / corruption.max : 0}
        />
      </div>
      <CurrencyRow gc={gc} ss={ss} bp={bp} />
    </div>
  )
}
