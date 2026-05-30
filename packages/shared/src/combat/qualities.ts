import type { Armor, Character, Weapon } from '../types/wfrp.types';
import { normalizeArmorLocations } from '../utils/armorLocations';
import { calculateCharacteristicValue } from '../utils/skills';
import type {
    ApModifierContext,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    CritResolverContext,
    DamageModifierContext,
    MeleeResolutionHooks,
    OnHitContext,
    QualityActivation,
    SlModifierContext,
} from './types';

export type QualityHookPhase = 'preRollModifiers' | 'slModifiers' | 'damageModifiers' | 'apModifiers' | 'onHitEffects' | 'onCritEffects' | 'critTriggerExtensions' | 'critIgnoreConditions' | 'critApModifiers' | 'fumbleTriggers';

export interface QualityEffectDefinition {
    qualityId: string;
    phase: QualityHookPhase;
    activation?: QualityActivation;
    deferred?: boolean;
}

export const qualityEffectRegistry: Record<string, QualityEffectDefinition[]> = {
    precise: [{ qualityId: 'precise', phase: 'slModifiers' }],
    imprecise: [{ qualityId: 'imprecise', phase: 'slModifiers' }],
    defensive: [{ qualityId: 'defensive', phase: 'slModifiers' }],
    unbalanced: [{ qualityId: 'unbalanced', phase: 'slModifiers' }],
    wrap: [{ qualityId: 'wrap', phase: 'slModifiers' }],
    slow: [{ qualityId: 'slow', phase: 'slModifiers' }],
    fast: [{ qualityId: 'fast', phase: 'slModifiers' }, { qualityId: 'fast', phase: 'preRollModifiers', deferred: true }],
    damaging: [{ qualityId: 'damaging', phase: 'damageModifiers' }],
    impact: [{ qualityId: 'impact', phase: 'damageModifiers' }],
    tiring: [{ qualityId: 'tiring', phase: 'damageModifiers' }],
    penetrating: [{ qualityId: 'penetrating', phase: 'apModifiers' }],
    undamaging: [{ qualityId: 'undamaging', phase: 'apModifiers' }],
    shield: [{ qualityId: 'shield', phase: 'apModifiers' }],
    pummel: [{ qualityId: 'pummel', phase: 'onHitEffects' }],
    entangle: [{ qualityId: 'entangle', phase: 'onHitEffects' }],
    distract: [{ qualityId: 'distract', phase: 'onHitEffects' }],
    trip: [{ qualityId: 'trip', phase: 'onHitEffects', activation: activation('onHit', 'trip', 2, 'never') }],
    blackpowder: [{ qualityId: 'blackpowder', phase: 'onHitEffects' }],
    pistol: [{ qualityId: 'pistol', phase: 'preRollModifiers', deferred: true }],
    impale: [{ qualityId: 'impale', phase: 'critTriggerExtensions' }],
    impenetrable: [{ qualityId: 'impenetrable', phase: 'critIgnoreConditions' }],
    weakpoints: [{ qualityId: 'weakpoints', phase: 'critApModifiers' }],
    partial: [{ qualityId: 'partial', phase: 'critApModifiers' }],
    slash: [{ qualityId: 'slash', phase: 'onCritEffects', activation: activation('onCrit', 'slashExtraBleeding', 1, 'never') }],
    trap_blade: [{ qualityId: 'trap_blade', phase: 'onCritEffects', activation: activation('onDefend', 'trapBlade', undefined, 'never') }],
    dangerous: [{ qualityId: 'dangerous', phase: 'fumbleTriggers' }],
    reinforced: [{ qualityId: 'reinforced', phase: 'apModifiers' }],
    flexible: [{ qualityId: 'flexible', phase: 'apModifiers' }],
    overcoat: [{ qualityId: 'overcoat', phase: 'apModifiers' }],
};

export function createQualityHooks(): Partial<MeleeResolutionHooks> {
    return {
        slModifiers: qualitySlModifier,
        damageModifiers: qualityDamageModifier,
        apModifiers: qualityApModifier,
        onHitEffects: qualityOnHitEffects,
        critTriggerExtensions: qualityCritTriggerExtensions,
        critIgnoreConditions: qualityCritIgnoreConditions,
        critApModifiers: qualityCritApModifiers,
        onCritEffects: qualityOnCritEffects,
        fumbleTriggers: qualityFumbleTriggers,
    };
}

export function applyBlackpowderTargetEffect(context: SlModifierContext): CombatEngineResult {
    const weapon = attackWeapon(context);
    if (!weapon || !hasQuality(weapon, 'blackpowder')) return { state: context.state, events: [] };
    return {
        state: addCondition(context.state, context.defender.id, 'condition_broken'),
        events: [qualityEvent(context.attacker.id, context.defender.id, 'blackpowder', 'coolTestRequired')],
    };
}

export function defenderTargetModifierFromQualities(context: SlModifierContext): number {
    const attackerWeapon = attackWeapon(context);
    const defenderWeapon = defendWeapon(context);
    if (attackerWeapon && hasQuality(attackerWeapon, 'fast') && !(defenderWeapon && hasQuality(defenderWeapon, 'fast'))) {
        return -10;
    }
    return 0;
}

export function armourPointsAtLocation(character: Character, location: string, armorData: Armor[]): number {
    return armourLayersAtLocation(character, location, armorData)
        .reduce((total, armor) => total + armor.ap + (hasQuality(armor, 'reinforced') ? 1 : 0), 0);
}

export function armourLayersAtLocation(character: Character, location: string, armorData: Armor[]): Armor[] {
    const armorById: Record<string, Armor> = Object.fromEntries(armorData.map(armor => [armor.id, armor]));
    const normalizedLocation = normalizeArmorLocations([location])[0];
    const equipped = Object.entries(character.inventory?.equippedArmor || {})
        .filter(([, isEquipped]) => isEquipped)
        .map(([armorId]) => armorById[armorId])
        .filter((armor): armor is Armor => !!armor && armor.locations.some(candidate => normalizeArmorLocations([candidate]).includes(normalizedLocation)));

    const flexibleOrOvercoat = equipped.filter(armor => hasQuality(armor, 'flexible') || hasQuality(armor, 'overcoat'));
    const regular = equipped.filter(armor => !hasQuality(armor, 'flexible') && !hasQuality(armor, 'overcoat'));
    if (regular.length <= 1) return equipped;
    const bestRegular = [...regular].sort((a, b) => b.ap - a.ap)[0];
    return [...flexibleOrOvercoat, bestRegular];
}

export function attackWeapon(context: Pick<SlModifierContext, 'state' | 'attacker' | 'attackerRoll'>): Weapon | undefined {
    return weaponFromRollOrEquipped(context.state, context.attacker, context.attackerRoll.weaponId);
}

export function defendWeapon(context: Pick<SlModifierContext, 'state' | 'defender' | 'defenderRoll'>): Weapon | undefined {
    return weaponFromRollOrEquipped(context.state, context.defender, context.defenderRoll?.weaponId);
}

export function hasQuality(item: { qualities?: string[] }, qualityId: string): boolean {
    return qualityEntries(item).some(entry => entry.id === qualityId);
}

export function qualityRating(item: { qualities?: string[] }, qualityId: string): number | undefined {
    return qualityEntries(item).find(entry => entry.id === qualityId)?.rating;
}

function qualitySlModifier(context: SlModifierContext): number {
    const attackerWeapon = attackWeapon(context);
    const defenderWeapon = defendWeapon(context);
    const attacking = !context.defenderRoll;
    let modifier = 0;

    if (attacking) {
        if (attackerWeapon && hasQuality(attackerWeapon, 'precise') && context.attackerRoll.rollResult <= context.attackerRoll.targetNumber) modifier += 1;
        if (attackerWeapon && hasQuality(attackerWeapon, 'imprecise')) modifier -= 1;
        return modifier;
    }

    if (defenderWeapon && hasQuality(defenderWeapon, 'defensive')) modifier += 1;
    if (defenderWeapon && hasQuality(defenderWeapon, 'unbalanced')) modifier -= 1;
    if (attackerWeapon && hasQuality(attackerWeapon, 'wrap')) modifier -= 1;
    if (attackerWeapon && hasQuality(attackerWeapon, 'slow')) modifier += 1;
    return modifier;
}

function qualityDamageModifier(context: DamageModifierContext): number {
    const weapon = attackWeapon(context);
    if (!weapon) return 0;
    const tiringBlocks = hasQuality(weapon, 'tiring') && !context.action.isCharging;
    const unitsDie = context.attackerRoll.rollResult % 10 || 10;
    let modifier = 0;

    if (!tiringBlocks && hasQuality(weapon, 'damaging') && context.defenderSuccessLevel !== undefined) {
        let baseSLModifier = context.attackerSuccessLevel - (context.defenderSuccessLevel ?? 0);
        modifier += Math.max(0, unitsDie - baseSLModifier);
    }
    if (!tiringBlocks && hasQuality(weapon, 'impact')) {
        modifier += unitsDie;
    }
    return modifier;
}

function qualityApModifier(context: ApModifierContext): number {
    const weapon = attackWeapon(context);
    const defenderShield = defendWeapon(context);
    let modifier = 0;

    if (weapon && hasQuality(weapon, 'undamaging')) modifier += context.armourPoints;
    if (weapon && hasQuality(weapon, 'penetrating') && context.armourPoints > 0) {
        const reduction = armourLayersAtLocation(context.defender.character, context.hitLocation, context.state.armor)
            .reduce((total, armor) => {
                const layerAp = armor.ap + (hasQuality(armor, 'reinforced') ? 1 : 0);
                const isMetal = armor.type === 'Mail' || armor.type === 'Plate';
                return total + (isMetal ? Math.min(1, layerAp) : layerAp);
            }, 0);
        modifier -= Math.min(context.armourPoints, reduction);
    }
    if (defenderShield) modifier += qualityRating(defenderShield, 'shield') ?? 0;
    return modifier;
}

function qualityOnHitEffects(context: OnHitContext): CombatEngineResult & { suppressNormalDamage?: boolean } {
    const weapon = attackWeapon(context);
    if (!weapon) return { state: context.state, events: [] };

    let state = context.state;
    const events: CombatEvent[] = [];
    let suppressNormalDamage = false;

    if (hasQuality(weapon, 'pummel') && context.hitLocation.toLowerCase().includes('head')) {
        state = addCondition(state, context.defender.id, 'condition_stunned');
        events.push(qualityEvent(context.attacker.id, context.defender.id, 'pummel', 'stunned', 1));
    }

    if (hasQuality(weapon, 'entangle')) {
        state = addCondition(state, context.defender.id, 'condition_entangled');
        state = addDeferred(state, context.defender.id, `Entangled Strength ${calculateCharacteristicValue(context.attacker.character.characteristics.s)}`);
        suppressNormalDamage = true;
        events.push(qualityEvent(context.attacker.id, context.defender.id, 'entangle', 'entangled', calculateCharacteristicValue(context.attacker.character.characteristics.s)));
    }

    if (hasQuality(weapon, 'distract')) {
        const yards = Math.max(1, context.attackerSuccessLevel);
        state = moveCombatant(state, context.defender.id, yards);
        suppressNormalDamage = true;
        events.push(qualityEvent(context.attacker.id, context.defender.id, 'distract', 'push', yards));
    }

    if (hasQuality(weapon, 'trip')) {
        const activationEffect = activation('onHit', 'trip', 2, 'never');
        events.push(qualityEvent(context.attacker.id, context.defender.id, 'trip', 'activationAvailable', 2, activationEffect));
    }

    return { state, events, suppressNormalDamage };
}

function qualityCritTriggerExtensions(context: CritResolverContext): boolean {
    const weapon = attackWeapon(context);
    const roll = context.roll ?? context.attackerRoll.rollResult;
    return !!weapon && hasQuality(weapon, 'impale') && roll % 10 === 0 && roll <= (context.targetNumber ?? context.attackerRoll.targetNumber);
}

function qualityCritIgnoreConditions(context: CritResolverContext): boolean {
    const roll = context.roll ?? context.attackerRoll.rollResult;
    return roll % 2 === 1 && armourLayersAtLocation(context.defender.character, context.hitLocation, context.state.armor)
        .some(armor => hasQuality(armor, 'impenetrable'));
}

function qualityCritApModifiers(context: CritResolverContext): number {
    const weapon = attackWeapon(context);
    const layers = armourLayersAtLocation(context.defender.character, context.hitLocation, context.state.armor);
    if (weapon && hasQuality(weapon, 'impale') && layers.some(armor => hasQuality(armor, 'weakpoints'))) {
        return -context.armourPoints;
    }
    if (layers.some(armor => hasQuality(armor, 'partial'))) {
        return -context.armourPoints;
    }
    return 0;
}

function qualityOnCritEffects(context: CritResolverContext): CombatEngineResult {
    const weapon = attackWeapon(context);
    if (!weapon || !hasQuality(weapon, 'slash')) return { state: context.state, events: [] };
    const rating = qualityRating(weapon, 'slash') ?? 1;
    const state = addCondition(context.state, context.combatantId, 'condition_bleeding');
    const activationOption = activation('onCrit', 'slashExtraBleeding', rating, 'never');
    return {
        state,
        events: [
            qualityEvent(context.attacker.id, context.combatantId, 'slash', 'bleeding', 1),
            qualityEvent(context.attacker.id, context.combatantId, 'slash', 'activationAvailable', rating, activationOption),
        ],
    };
}

function qualityFumbleTriggers(context: SlModifierContext): boolean {
    const weapon = attackWeapon(context);
    const roll = context.attackerRoll.rollResult;
    return !!weapon && hasQuality(weapon, 'dangerous') && roll > context.attackerRoll.targetNumber && (Math.floor(roll / 10) === 9 || roll % 10 === 9);
}

function weaponFromRollOrEquipped(state: CombatState, combatant: Combatant, weaponId?: string): Weapon | undefined {
    const id = weaponId
        ?? Object.entries(combatant.character.inventory.equippedWeapons || {}).find(([, equipped]) => equipped)?.[0]
        ?? Object.entries(combatant.character.inventory.weapons || {}).find(([, count]) => count > 0)?.[0];
    return id ? state.weapons.find(weapon => weapon.id === id) : undefined;
}

function qualityEntries(item: { qualities?: string[] }): Array<{ id: string; rating?: number }> {
    return (item.qualities || []).flatMap(raw => {
        const normalized = raw.replace(/\*/g, '').trim();
        return normalized.split(/\s+or\s+/i).map(part => {
            const match = part.trim().match(/^(.+?)\s+(\d+)$/);
            const name = (match ? match[1] : part).trim().toLowerCase().replace(/[\s-]+/g, '_');
            return { id: name, rating: match ? Number(match[2]) : undefined };
        });
    });
}

function activation(trigger: QualityActivation['trigger'], effect: string, advantageCost?: number, policy: 'always' | 'never' = 'always'): QualityActivation {
    return {
        trigger,
        effect,
        cost: advantageCost === undefined ? undefined : { resource: 'advantage', amount: advantageCost },
        policy,
    };
}

function qualityEvent(combatantId: string, targetId: string | undefined, qualityId: string, effect: string, amount?: number, activationOption?: QualityActivation): CombatEvent {
    return {
        type: 'QualityEffectApplied',
        i18nKey: `combat.quality.${qualityId}.${effect}`,
        data: { combatantId, targetId, qualityId, effect, amount, activation: activationOption },
    };
}

function addCondition(state: CombatState, combatantId: string, conditionId: string): CombatState {
    const combatant = state.combatants[combatantId];
    if (!combatant) return state;
    const nonStacking = ['condition_prone', 'condition_surprised', 'condition_unconscious'];
    const alreadyHasNonStacking = nonStacking.includes(conditionId) && combatant.conditions.includes(conditionId);
    return replaceCombatant(state, {
        ...combatant,
        conditions: alreadyHasNonStacking ? combatant.conditions : [...combatant.conditions, conditionId],
    });
}

function addDeferred(state: CombatState, combatantId: string, note: string): CombatState {
    const combatant = state.combatants[combatantId] as Combatant & { qualityNotes?: string[] } | undefined;
    if (!combatant) return state;
    return replaceCombatant(state, { ...combatant, qualityNotes: [...(combatant.qualityNotes || []), note] } as Combatant);
}

function moveCombatant(state: CombatState, combatantId: string, yards: number): CombatState {
    const combatant = state.combatants[combatantId];
    if (!combatant) return state;
    return replaceCombatant(state, { ...combatant, position: combatant.position + yards });
}

function replaceCombatant(state: CombatState, combatant: Combatant): CombatState {
    return {
        ...state,
        combatants: {
            ...state.combatants,
            [combatant.id]: combatant,
        },
    };
}
