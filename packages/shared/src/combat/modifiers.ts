import { attackerModifiersFor } from '../utils/conditions';
import { grappleOutsiderToHitModifier } from './actions';
import { calledShotPenaltyFor, ignoresWeaponLengthPenalty, offHandPenaltyFor } from './talents';
import type { Combatant, CombatantSize, CombatState, CoverLevel, MeleeAttackAction, ModifierSource, ModifierTotal, RangedRangeBand, RangedAttackAction } from './types';
import { reachOf } from './spatial';
import { additionalEffortTestModifier } from './advantage';

const SIZE_RANK: Record<CombatantSize, number> = {
    tiny: 0,
    little: 1,
    small: 2,
    average: 3,
    large: 4,
    enormous: 5,
    monstrous: 6,
};

export function resolveModifierTotal(sources: ModifierSource[]): ModifierTotal {
    const uncappedBonus = sources.filter(source => source.value > 0).reduce((total, source) => total + source.value, 0);
    const uncappedPenalty = sources.filter(source => source.value < 0).reduce((total, source) => total + source.value, 0);
    const cappedBonus = Math.min(60, uncappedBonus);
    const cappedPenalty = Math.max(-30, uncappedPenalty);

    return {
        sources,
        uncappedBonus,
        uncappedPenalty,
        cappedBonus,
        cappedPenalty,
        total: cappedBonus + cappedPenalty,
    };
}

export function collectMeleePreRollModifiers(
    state: CombatState,
    action: MeleeAttackAction,
    attacker: Combatant,
    defender: Combatant
): ModifierSource[] {
    const sources: ModifierSource[] = [];
    const conditionModifiers = attackerModifiersFor(defender);

    for (const source of conditionModifiers.sources.filter(source => source.kind === 'toHit')) {
        sources.push({
            id: `condition:${source.conditionId}`,
            type: 'condition',
            phase: 'preRollModifiers',
            value: source.value,
            combatantId: defender.id,
        });
    }

    const outnumbering = outnumberingToHitModifier(state, attacker, defender);
    if (outnumbering !== 0) {
        sources.push({ id: 'outnumbering', type: 'outnumbering', phase: 'preRollModifiers', value: outnumbering, combatantId: attacker.id });
    }

    const attackerReach = reachOf(attacker, state.weapons);
    const defenderReach = reachOf(defender, state.weapons);
    if (attackerReach.rank < defenderReach.rank && !ignoresWeaponLengthPenalty(attacker)) {
        sources.push({ id: 'weaponLength:shorterAttacker', type: 'weaponLength', phase: 'preRollModifiers', value: -10, combatantId: attacker.id });
    }

    const calledShotPenalty = calledShotPenaltyFor({ state, action, attacker, defender });
    if (calledShotPenalty !== 0) {
        sources.push({ id: 'calledShot:location', type: 'manual', phase: 'preRollModifiers', value: calledShotPenalty, combatantId: attacker.id });
    }

    const sizeModifier = sizeDifferenceModifier(
        action.attackerSize ?? combatantSize(attacker),
        action.defenderSize ?? combatantSize(defender)
    );
    if (sizeModifier !== 0) {
        sources.push({ id: 'size:difference', type: 'size', phase: 'preRollModifiers', value: sizeModifier, combatantId: defender.id });
    }

    if (action.isCharging || state.turnFlags.chargedCombatantIds.includes(attacker.id)) {
        sources.push({ id: 'charging:firstMeleeTest', type: 'charging', phase: 'preRollModifiers', value: 10, combatantId: attacker.id });
    }

    if (action.hand === 'secondary') {
        sources.push({ id: 'dualWield:offHand', type: 'manual', phase: 'preRollModifiers', value: offHandPenaltyFor(attacker), combatantId: attacker.id });
    }

    const grappleOutsider = grappleOutsiderToHitModifier(state, attacker, defender);
    if (grappleOutsider !== 0) {
        sources.push({ id: 'grapple:outsider', type: 'manual', phase: 'preRollModifiers', value: grappleOutsider, combatantId: attacker.id });
    }

    const effortModifier = additionalEffortTestModifier(state, attacker.id);
    if (effortModifier !== 0) {
        sources.push({ id: 'additionalEffort', type: 'additionalEffort', phase: 'preRollModifiers', value: effortModifier, combatantId: attacker.id });
        
    }

    // Registered for PBI 4; melee attacks currently provide no ranged values.
    sources.push(
        { id: 'range:empty', type: 'range', phase: 'preRollModifiers', value: 0 },
        { id: 'cover:empty', type: 'cover', phase: 'preRollModifiers', value: 0 },
        { id: 'group:empty', type: 'group', phase: 'preRollModifiers', value: 0 }
    );

    return sources;
}

export function collectRangedPreRollModifiers(
    state: CombatState,
    action: RangedAttackAction,
    attacker: Combatant,
    defender: Combatant,
    rangeBand: Exclude<RangedRangeBand, 'outOfRange'>
): ModifierSource[] {
    const sources: ModifierSource[] = [];
    const conditionModifiers = attackerModifiersFor(defender);

    for (const source of conditionModifiers.sources.filter(source => source.kind === 'toHit')) {
        sources.push({
            id: `condition:${source.conditionId}`,
            type: 'condition',
            phase: 'preRollModifiers',
            value: source.value,
            combatantId: defender.id,
        });
    }

    const rangeModifier = rangeBandModifier(rangeBand, attacker);
    if (rangeModifier !== 0) {
        sources.push({ id: `range:${rangeBand}`, type: 'range', phase: 'preRollModifiers', value: rangeModifier, combatantId: attacker.id });
    }

    const sizeModifier = sizeDifferenceModifier(
        action.attackerSize ?? combatantSize(attacker),
        action.defenderSize ?? combatantSize(defender)
    );
    if (sizeModifier !== 0 && !(sizeModifier < 0 && hasRangedTalent(attacker, 'sharpshooter'))) {
        sources.push({ id: 'size:difference', type: 'size', phase: 'preRollModifiers', value: sizeModifier, combatantId: defender.id });
    }

    const coverModifier = coverPenalty(action.cover ?? 'none');
    if (coverModifier !== 0) {
        sources.push({ id: `cover:${action.cover}`, type: 'cover', phase: 'preRollModifiers', value: coverModifier, combatantId: defender.id });
    }

    if (action.shootingWhileMoving) {
        sources.push({ id: 'movement:shootingWhileMoving', type: 'manual', phase: 'preRollModifiers', value: -10, combatantId: attacker.id });
    }

    if (action.darkness) {
        sources.push({ id: 'darkness', type: 'manual', phase: 'preRollModifiers', value: -20, combatantId: attacker.id });
    }

    if (action.aimed || attacker.aimedRangedAttack) {
        sources.push({ id: 'aim:previousAction', type: 'manual', phase: 'preRollModifiers', value: 20, combatantId: attacker.id });
    }

    const effortModifier = additionalEffortTestModifier(state, attacker.id);
    if (effortModifier !== 0) {
        sources.push({ id: 'additionalEffort', type: 'additionalEffort', phase: 'preRollModifiers', value: effortModifier, combatantId: attacker.id });
    }

    const groupCount = (action as RangedAttackAction & { groupTargetCount?: number }).groupTargetCount;
    const groupModifier = groupCount ? groupShotModifier(groupCount) : 0;
    if (groupModifier !== 0) {
        sources.push({ id: `group:targets:${groupCount}`, type: 'group', phase: 'preRollModifiers', value: groupModifier, combatantId: attacker.id });
    }

    return sources;
}

export function groupShotModifier(count: number): number {
    if (count >= 13) return 60;
    if (count >= 7) return 40;
    if (count >= 3) return 20;
    return 0;
}

function rangeBandModifier(rangeBand: Exclude<RangedRangeBand, 'outOfRange'>, attacker: Combatant): number {
    if (rangeBand === 'pointBlank') return 40;
    if (rangeBand === 'short') return 20;
    if (rangeBand === 'long' && hasRangedTalent(attacker, 'sniper')) return 0;
    if (rangeBand === 'extreme' && hasRangedTalent(attacker, 'sniper')) return -15;
    if (rangeBand === 'long') return -10;
    if (rangeBand === 'extreme') return -30;
    return 0;
}

function coverPenalty(cover: CoverLevel): number {
    if (cover === 'soft') return -10;
    if (cover === 'medium') return -20;
    if (cover === 'hard') return -30;
    return 0;
}

function hasRangedTalent(combatant: Combatant, talentId: string): boolean {
    const normalized = talentId.toLowerCase();
    return (combatant.character.talents?.[talentId] ?? combatant.character.talents?.[normalized] ?? 0) > 0;
}

export function outnumberingToHitModifier(state: CombatState, attacker: Combatant, defender: Combatant): number {
    const virtualState = withVirtualEngagement(state, attacker.id, defender.id);
    const groupIds = engagementGroupIds(virtualState, defender.id);
    const counts = effectiveOutnumberingCounts(virtualState, groupIds);
    const attackingSideCount = counts[attacker.side];
    const defendingSideCount = counts[defender.side];

    if (defendingSideCount <= 0) return 0;
    if (attackingSideCount >= defendingSideCount * 3) return 40;
    if (attackingSideCount >= defendingSideCount * 2) return 20;
    return 0;
}

function effectiveOutnumberingCounts(state: CombatState, groupIds: Set<string>): Record<Combatant['side'], number> {
    const living = [...groupIds]
        .map(id => state.combatants[id])
        .filter((combatant): combatant is Combatant => !!combatant && combatant.currentWounds > 0);
    const baseCounts = living.reduce((counts, combatant) => ({
        ...counts,
        [combatant.side]: counts[combatant.side] + 1,
    }), { ally: 0, adversary: 0 });
    const outnumberedSide = baseCounts.ally === baseCounts.adversary
        ? undefined
        : baseCounts.ally < baseCounts.adversary ? 'ally' : 'adversary';

    return living.reduce((counts, combatant) => {
        const combatMasterRanks = outnumberedSide === combatant.side ? combatant.character.talents?.['combat-master'] ?? 0 : 0;
        return {
            ...counts,
            [combatant.side]: counts[combatant.side] + combatMasterRanks,
        };
    }, baseCounts);
}

export function sizeDifferenceModifier(attackerSize: CombatantSize, defenderSize: CombatantSize): number {
    const difference = SIZE_RANK[defenderSize] - SIZE_RANK[attackerSize];
    if (difference <= -3) return -30;
    if (difference === -2) return -20;
    if (difference === -1) return -10;
    if (difference === 1) return 20;
    if (difference === 2) return 40;
    if (difference >= 3) return 60;
    return 0;
}

export function combatantSize(combatant: Combatant): CombatantSize {
    const explicitSize = (combatant as Combatant & { size?: CombatantSize }).size
        ?? (combatant.character as Combatant['character'] & { size?: CombatantSize }).size;
    if (explicitSize && explicitSize in SIZE_RANK) return explicitSize;

    const sizeTag = combatant.character.tags
        .map(tag => tag.toLowerCase().trim())
        .find(tag => tag.startsWith('size:') || tag.startsWith('size='));
    const taggedSize = sizeTag?.split(/[:=]/)[1] as CombatantSize | undefined;
    return taggedSize && taggedSize in SIZE_RANK ? taggedSize : 'average';
}

function withVirtualEngagement(state: CombatState, aId: string, bId: string): CombatState {
    const a = state.combatants[aId];
    const b = state.combatants[bId];
    if (!a || !b) return state;
    return {
        ...state,
        combatants: {
            ...state.combatants,
            [aId]: { ...a, engagementIds: [...new Set([...a.engagementIds, bId])] },
            [bId]: { ...b, engagementIds: [...new Set([...b.engagementIds, aId])] },
        },
    };
}

function engagementGroupIds(state: CombatState, combatantId: string): Set<string> {
    const visited = new Set<string>();
    const queue = [combatantId];

    while (queue.length > 0) {
        const id = queue.shift();
        if (!id || visited.has(id)) continue;
        visited.add(id);

        for (const engagedId of state.combatants[id]?.engagementIds || []) {
            if (!visited.has(engagedId)) queue.push(engagedId);
        }
    }

    return visited;
}
