import { useState, useMemo, useCallback } from 'react'
import {
  type Character,
  type Weapon,
  type Armor,
  type Item,
  type ItemQualityDefinition,
  type Talent,
  useGameData,
  toggleWeaponEquipped,
  toggleArmorEquipped,
  calculateEffectiveMaxEncumbrance,
  calculateCharacteristicBonus,
  getQualityInfo,
} from '@wfrp/shared'
import { Tabs } from '../ui/Tabs'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { usePlayerModal } from '../../context/PlayerModalContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryPanelProps {
  character: Character
  onUpdate: (partial: Partial<Character>) => Promise<void>
}

type WeaponEntry = Weapon & { count: number; equipped: boolean }
type ArmorEntry = Armor & { count: number; equipped: boolean }
type ItemEntry = Item & { count: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDamage(damage: string, sb: number): string {
  return damage
    .replace(/SB/g, String(sb))
    .replace(/(\d+)\+(\d+)/g, (_, a, b) => String(Number(a) + Number(b)))
}

// ─── Quality tag ──────────────────────────────────────────────────────────────

function QualityTag({ qualityString, onTap }: { qualityString: string; onTap: (q: string) => void }) {
  const label = qualityString.charAt(0).toUpperCase() + qualityString.slice(1)
  return (
    <button
      type="button"
      onClick={() => onTap(qualityString)}
      className="text-xs text-brass hover:text-brass-light underline decoration-dotted underline-offset-2 focus:outline-none transition-colors"
    >
      {label}
    </button>
  )
}

// ─── Quality detail modal ─────────────────────────────────────────────────────

function QualityDetail({
  qualityString,
  qualities,
  onClose,
}: {
  qualityString: string
  qualities: ItemQualityDefinition[]
  onClose: () => void
}) {
  const { definition } = getQualityInfo(qualityString, qualities)
  const isFlaw = definition?.type === 'flaw'

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-lg text-accent leading-tight flex-1">
          {definition?.name ?? qualityString}
        </h3>
        <Badge variant={isFlaw ? 'danger' : 'success'} size="sm">
          {definition?.type ?? 'quality'}
        </Badge>
      </div>
      <p className="text-sm text-primary font-body leading-relaxed">
        {definition?.description ?? 'No description available.'}
      </p>
      <button
        className="w-full text-center text-xs text-secondary hover:text-primary transition-colors pt-1"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  )
}

// ─── Encumbrance bar ──────────────────────────────────────────────────────────

function EncumbranceBar({ current, max }: { current: number; max: number }) {
  const isOver = current > max
  const fill = max > 0 ? Math.min(current / max, 1) : 0

  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-display tracking-widest text-secondary uppercase whitespace-nowrap">
        Encumbrance
      </span>
      <div className="flex-1 h-1.5 bg-bg-dark rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-blood' : 'bg-brass'}`}
          style={{ width: `${fill * 100}%` }}
        />
      </div>
      <span className={`text-xs font-display tabular-nums whitespace-nowrap ${isOver ? 'text-blood-light' : 'text-secondary'}`}>
        {current}/{max}
        {isOver && ' ⚠'}
      </span>
    </div>
  )
}

// ─── Equip button ─────────────────────────────────────────────────────────────

function EquipButton({ equipped, loading, onToggle }: { equipped: boolean; loading: boolean; onToggle: () => void }) {
  return (
    <Button
      variant={equipped ? 'primary' : 'secondary'}
      size="sm"
      loading={loading}
      onClick={onToggle}
      className="shrink-0 min-w-[76px]"
    >
      {equipped ? 'Equipped' : 'Equip'}
    </Button>
  )
}

// ─── Row components ───────────────────────────────────────────────────────────

function WeaponRow({
  weapon,
  sb,
  loading,
  onToggle,
  onQualityTap,
}: {
  weapon: WeaponEntry
  sb: number
  loading: boolean
  onToggle: () => void
  onQualityTap: (q: string) => void
}) {
  const damage = formatDamage(weapon.damage, sb)
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-dark last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-display text-accent">{weapon.name}</span>
          {weapon.count > 1 && <span className="text-[10px] text-muted">×{weapon.count}</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className="text-xs text-secondary capitalize">{weapon.group}</span>
          <span className="text-xs text-primary">DMG {damage}</span>
          <span className="text-xs text-secondary">Reach: {weapon.reach}</span>
          <span className="text-xs text-muted">Enc {weapon.enc}</span>
        </div>
        {weapon.qualities.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
            {weapon.qualities.map((q) => (
              <QualityTag key={q} qualityString={q} onTap={onQualityTap} />
            ))}
          </div>
        )}
      </div>
      <EquipButton equipped={weapon.equipped} loading={loading} onToggle={onToggle} />
    </div>
  )
}

function ArmorRow({
  armor,
  loading,
  onToggle,
  onQualityTap,
}: {
  armor: ArmorEntry
  loading: boolean
  onToggle: () => void
  onQualityTap: (q: string) => void
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-dark last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm font-display text-accent">{armor.name}</span>
          {armor.count > 1 && <span className="text-[10px] text-muted">×{armor.count}</span>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          <span className="text-xs text-secondary">{armor.type}</span>
          <span className="text-xs text-primary">AP {armor.ap}</span>
          <span className="text-xs text-secondary">{armor.locations.join(', ')}</span>
          <span className="text-xs text-muted">Enc {armor.enc}</span>
        </div>
        {armor.penalty && (
          <span className="text-xs text-blood-light block mt-0.5">{armor.penalty}</span>
        )}
        {armor.qualities.length > 0 && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
            {armor.qualities.map((q) => (
              <QualityTag key={q} qualityString={q} onTap={onQualityTap} />
            ))}
          </div>
        )}
      </div>
      <EquipButton equipped={armor.equipped} loading={loading} onToggle={onToggle} />
    </div>
  )
}

function ItemRow({ item }: { item: ItemEntry }) {
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-dark last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-sm text-accent">{item.name}</span>
          {item.count > 1 && <span className="text-[10px] text-muted">×{item.count}</span>}
        </div>
        <span className="text-xs text-muted">
          Enc {item.enc}
          {item.price ? ` · ${item.price}` : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Section components ───────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-display tracking-widest text-muted uppercase pt-2 pb-1">
      {text}
    </p>
  )
}

function WeaponsSection({
  weapons,
  sb,
  inFlight,
  onToggle,
  onQualityTap,
}: {
  weapons: WeaponEntry[]
  sb: number
  inFlight: Set<string>
  onToggle: (id: string) => void
  onQualityTap: (q: string) => void
}) {
  if (weapons.length === 0) {
    return <p className="text-sm text-muted text-center py-4">No weapons carried.</p>
  }
  const equipped = weapons.filter((w) => w.equipped)
  const carried = weapons.filter((w) => !w.equipped)
  return (
    <div>
      {equipped.map((w) => (
        <WeaponRow key={w.id} weapon={w} sb={sb} loading={inFlight.has(w.id)} onToggle={() => onToggle(w.id)} onQualityTap={onQualityTap} />
      ))}
      {equipped.length > 0 && carried.length > 0 && <SectionLabel text="Carried" />}
      {carried.map((w) => (
        <WeaponRow key={w.id} weapon={w} sb={sb} loading={inFlight.has(w.id)} onToggle={() => onToggle(w.id)} onQualityTap={onQualityTap} />
      ))}
    </div>
  )
}

function ArmorSection({
  armors,
  inFlight,
  onToggle,
  onQualityTap,
}: {
  armors: ArmorEntry[]
  inFlight: Set<string>
  onToggle: (id: string) => void
  onQualityTap: (q: string) => void
}) {
  if (armors.length === 0) {
    return <p className="text-sm text-muted text-center py-4">No armor carried.</p>
  }
  const equipped = armors.filter((a) => a.equipped)
  const carried = armors.filter((a) => !a.equipped)
  return (
    <div>
      {equipped.map((a) => (
        <ArmorRow key={a.id} armor={a} loading={inFlight.has(a.id)} onToggle={() => onToggle(a.id)} onQualityTap={onQualityTap} />
      ))}
      {equipped.length > 0 && carried.length > 0 && <SectionLabel text="Carried" />}
      {carried.map((a) => (
        <ArmorRow key={a.id} armor={a} loading={inFlight.has(a.id)} onToggle={() => onToggle(a.id)} onQualityTap={onQualityTap} />
      ))}
    </div>
  )
}

function ItemsSection({ items }: { items: ItemEntry[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted text-center py-4">No items carried.</p>
  }
  return (
    <div>
      {items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
    </div>
  )
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColHeader({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-display tracking-widest text-secondary uppercase mb-1 pb-1 border-b border-dark">
      {text}
    </p>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InventoryPanel({ character, onUpdate }: InventoryPanelProps) {
  const gameData = useGameData()
  const breakpoint = useBreakpoint()
  const { openModal, closeModal } = usePlayerModal()
  const [activeTab, setActiveTab] = useState('weapons')
  const [isOpen, setIsOpen] = useState(true)
  const [inFlight, setInFlight] = useState<Set<string>>(new Set())

  // Lookup maps
  const weaponById = useMemo(
    () => new Map((gameData.weapons as Weapon[]).map((w) => [w.id, w])),
    [gameData.weapons]
  )
  const armorById = useMemo(
    () => new Map((gameData.armor as Armor[]).map((a) => [a.id, a])),
    [gameData.armor]
  )
  const itemById = useMemo(
    () => new Map((gameData.items as Item[]).map((i) => [i.id, i])),
    [gameData.items]
  )

  // Build typed item lists
  const weapons = useMemo((): WeaponEntry[] =>
    Object.entries(character.inventory.weapons)
      .flatMap(([id, count]) => {
        const def = weaponById.get(id)
        return def ? [{ ...def, count, equipped: (character.inventory.equippedWeapons ?? {})[id] === true }] : []
      }),
    [character.inventory, weaponById]
  )

  const armors = useMemo((): ArmorEntry[] =>
    Object.entries(character.inventory.armor)
      .flatMap(([id, count]) => {
        const def = armorById.get(id)
        return def ? [{ ...def, count, equipped: (character.inventory.equippedArmor ?? {})[id] === true }] : []
      }),
    [character.inventory, armorById]
  )

  const items = useMemo((): ItemEntry[] =>
    Object.entries(character.inventory.items)
      .flatMap(([id, count]) => {
        const def = itemById.get(id)
        return def ? [{ ...def, count }] : []
      }),
    [character.inventory, itemById]
  )

  // Encumbrance (computed manually to avoid hidden hook in calculateTotalEncumbrance)
  const currentEnc = useMemo(() => {
    const equippedArmor = character.inventory.equippedArmor ?? {}
    const armorEnc = Object.entries(character.inventory.armor).reduce((sum, [id, count]) => {
      const baseEnc = armorById.get(id)?.enc ?? 0
      const effective = equippedArmor[id] === true ? Math.max(0, baseEnc - 1) : baseEnc
      return sum + effective * count
    }, 0)
    const weaponEnc = Object.entries(character.inventory.weapons).reduce(
      (sum, [id, count]) => sum + (weaponById.get(id)?.enc ?? 0) * count,
      0
    )
    const itemEnc = Object.entries(character.inventory.items).reduce(
      (sum, [id, count]) => sum + (itemById.get(id)?.enc ?? 0) * count,
      0
    )
    return armorEnc + weaponEnc + itemEnc
  }, [character.inventory, armorById, weaponById, itemById])

  const maxEnc = useMemo(
    () => calculateEffectiveMaxEncumbrance(character, gameData.talents as Talent[]),
    [character, gameData.talents]
  )

  const sb = calculateCharacteristicBonus(character.characteristics.s)

  // Quality modal
  const handleQualityTap = useCallback(
    (qualityString: string) => {
      const modalId = `quality-${qualityString}`
      openModal(
        modalId,
        <QualityDetail
          qualityString={qualityString}
          qualities={gameData.qualities as ItemQualityDefinition[]}
          onClose={() => closeModal(modalId)}
        />,
        { variant: breakpoint === 'mobile' ? 'sheet' : 'modal', size: 'sm' }
      )
    },
    [openModal, closeModal, gameData.qualities, breakpoint]
  )

  // Equip handlers with in-flight tracking
  const handleToggleWeapon = useCallback(
    async (weaponId: string) => {
      if (inFlight.has(weaponId)) return
      setInFlight((prev) => { const s = new Set(prev); s.add(weaponId); return s })
      try {
        const updated = toggleWeaponEquipped(character, weaponId)
        await onUpdate({ inventory: updated.inventory })
      } finally {
        setInFlight((prev) => { const s = new Set(prev); s.delete(weaponId); return s })
      }
    },
    [character, inFlight, onUpdate]
  )

  const handleToggleArmor = useCallback(
    async (armorId: string) => {
      if (inFlight.has(armorId)) return
      setInFlight((prev) => { const s = new Set(prev); s.add(armorId); return s })
      try {
        const updated = toggleArmorEquipped(character, armorId, gameData.armor as Armor[])
        await onUpdate({ inventory: updated.inventory })
      } finally {
        setInFlight((prev) => { const s = new Set(prev); s.delete(armorId); return s })
      }
    },
    [character, inFlight, onUpdate, gameData.armor]
  )

  const totalItemCount = weapons.length + armors.length + items.length
  const isMobile = breakpoint === 'mobile'

  // Collapsed state (mobile only)
  if (isMobile && !isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full wfrp-panel wfrp-grain-overlay p-3 flex items-center justify-between text-left"
      >
        <span className="font-display text-lg text-accent tracking-wide">Inventory</span>
        <span className="text-xs text-secondary">{totalItemCount} items ▶</span>
      </button>
    )
  }

  const weaponsSection = (
    <WeaponsSection weapons={weapons} sb={sb} inFlight={inFlight} onToggle={handleToggleWeapon} onQualityTap={handleQualityTap} />
  )
  const armorSection = (
    <ArmorSection armors={armors} inFlight={inFlight} onToggle={handleToggleArmor} onQualityTap={handleQualityTap} />
  )
  const itemsSection = <ItemsSection items={items} />

  const TABS = [
    { id: 'weapons', label: `Weapons (${weapons.length})` },
    { id: 'armor', label: `Armor (${armors.length})` },
    { id: 'items', label: `Items (${items.length})` },
  ]

  return (
    <div className="wfrp-panel wfrp-grain-overlay p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-accent tracking-wide m-0">Inventory</h3>
        {isMobile && (
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs text-secondary hover:text-primary transition-colors"
          >
            Collapse ▲
          </button>
        )}
      </div>

      {/* Encumbrance */}
      <EncumbranceBar current={currentEnc} max={maxEnc} />

      {/* Layout by breakpoint */}
      {isMobile ? (
        <div>
          <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="pt-2">
            {activeTab === 'weapons' && weaponsSection}
            {activeTab === 'armor' && armorSection}
            {activeTab === 'items' && itemsSection}
          </div>
        </div>
      ) : breakpoint === 'tablet' ? (
        <div className="grid grid-cols-2 gap-4 items-start">
          <div className="space-y-1">
            <ColHeader text={`Weapons (${weapons.length})`} />
            {weaponsSection}
            <div className="pt-3">
              <ColHeader text={`Armor (${armors.length})`} />
              {armorSection}
            </div>
          </div>
          <div>
            <ColHeader text={`Items (${items.length})`} />
            {itemsSection}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 items-start">
          <div>
            <ColHeader text={`Weapons (${weapons.length})`} />
            {weaponsSection}
          </div>
          <div>
            <ColHeader text={`Armor (${armors.length})`} />
            {armorSection}
          </div>
          <div>
            <ColHeader text={`Items (${items.length})`} />
            {itemsSection}
          </div>
        </div>
      )}
    </div>
  )
}
