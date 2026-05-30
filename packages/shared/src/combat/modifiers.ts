import { attackerModifiersFor } from '../utils/conditions';
import { grappleOutsiderToHitModifier, SECONDARY_HAND_PENALTY } from './actions';
import type { Combatant, CombatantSize, CombatState, MeleeAttackAction, ModifierSource, ModifierTotal } from './types';
import { reachOf } from './spatial';

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
    if (attackerReach.rank < defenderReach.rank) {
        sources.push({ id: 'weaponLength:shorterAttacker', type: 'weaponLength', phase: 'preRollModifiers', value: -10, combatantId: attacker.id });
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
        sources.push({ id: 'dualWield:offHand', type: 'manual', phase: 'preRollModifiers', value: SECONDARY_HAND_PENALTY, combatantId: attacker.id });
    }

    const grappleOutsider = grappleOutsiderToHitModifier(state, attacker, defender);
    if (grappleOutsider !== 0) {
        sources.push({ id: 'grapple:outsider', type: 'manual', phase: 'preRollModifiers', value: grappleOutsider, combatantId: attacker.id });
    }

    // Registered for PBI 4; melee attacks currently provide no ranged values.
    sources.push(
        { id: 'range:empty', type: 'range', phase: 'preRollModifiers', value: 0 },
        { id: 'cover:empty', type: 'cover', phase: 'preRollModifiers', value: 0 },
        { id: 'group:empty', type: 'group', phase: 'preRollModifiers', value: 0 }
    );

    return sources;
}

export function outnumberingToHitModifier(state: CombatState, attacker: Combatant, defender: Combatant): number {
    const virtualState = withVirtualEngagement(state, attacker.id, defender.id);
    const groupIds = engagementGroupIds(virtualState, defender.id);
    let attackingSideCount = 0;
    let defendingSideCount = 0;

    for (const id of groupIds) {
        const combatant = virtualState.combatants[id];
        if (!combatant || combatant.currentWounds <= 0) continue;
        if (combatant.side === attacker.side) attackingSideCount += 1;
        if (combatant.side === defender.side) defendingSideCount += 1;
    }

    if (defendingSideCount <= 0) return 0;
    if (attackingSideCount >= defendingSideCount * 3) return 40;
    if (attackingSideCount >= defendingSideCount * 2) return 20;
    return 0;
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
