import type { Weapon } from '../types/wfrp.types';
import { mathRandomRng, type Rng } from './rng';
import type { CombatEngineResult, CombatState, Combatant, MovementMode, MovementBudget } from './types';
import { resolveSourceApproachFear, resolveVoluntaryFearApproach } from './psychology';

export type RangeBand = 'Engaged' | 'Short' | 'Medium' | 'Long';

export interface RangeBandThresholds {
    engaged: number;
    short: number;
    medium: number;
}

export interface MovementAllowance {
    walk: number;
    run: number;
}

export type MoveTarget = number | { position: number } | { combatantId: string };

export type WeaponReach = 'N/A' | 'Personal' | 'Very Short' | 'Short' | 'Average' | 'Long' | 'Very Long' | 'Massive' | 'Varies';

export interface ReachInfo {
    reach: WeaponReach;
    rank: number;
    weaponId?: string;
    weaponName?: string;
}

export interface ReachOrderHint {
    order: string[];
    firstCombatantId?: string;
    tied: boolean;
    reaches: Record<string, ReachInfo>;
}

export const DEFAULT_RANGE_THRESHOLDS: RangeBandThresholds = {
    engaged: 2,
    short: 6,
    medium: 20,
};

const REACH_RANK: Record<WeaponReach, number> = {
    'N/A': 0,
    'Personal': 1,
    'Very Short': 2,
    'Short': 3,
    'Average': 4,
    'Long': 5,
    'Very Long': 6,
    'Massive': 7,
    'Varies': 4,
};

export const REACH_ENGAGEMENT_DISTANCE = {
    'N/A': 0,
    'Personal': 2,
    'Very Short': 2,
    'Short': 2,
    'Average': 2,
    'Long': 2,
    'Very Long': 4,
    'Massive': 6,
    'Varies': 2,
};

export function movementAllowanceFromMovement(movement: number): MovementAllowance {
    return {
        walk: movement * 2,
        run: movement * 4,
    };
}

export function getWalkRun(combatant: Combatant): MovementAllowance {
    return movementAllowanceFromMovement(combatant.character.movement);
}

export function createMovementBudget(movement: number): MovementBudget {
    const allowance = movementAllowanceFromMovement(movement);
    return { ...allowance, remaining: allowance.run };
}

export function distanceBetween(a: Combatant, b: Combatant): number {
    return Math.abs(a.position - b.position);
}

export function bandFor(distance: number, thresholds: RangeBandThresholds = DEFAULT_RANGE_THRESHOLDS): RangeBand {
    if (distance <= thresholds.engaged) return 'Engaged';
    if (distance <= thresholds.short) return 'Short';
    if (distance <= thresholds.medium) return 'Medium';
    return 'Long';
}

export function movementToReach(
    combatant: Combatant,
    target: Combatant | number,
    options: { thresholds?: RangeBandThresholds } = {}
): number {
    const thresholds = options.thresholds ?? DEFAULT_RANGE_THRESHOLDS;
    const targetPosition = typeof target === 'number' ? target : target.position;
    const distance = Math.abs(combatant.position - targetPosition);
    return Math.max(0, distance - thresholds.engaged);
}

export function canReach(
    combatant: Combatant,
    target: Combatant | number,
    options: { sprinting?: boolean; thresholds?: RangeBandThresholds } = {}
): boolean {
    if (combatant.budget.moves <= 0) return false;
    if (options.sprinting && combatant.budget.actions <= 0) return false;

    const allowance = getWalkRun(combatant);
    const modeAllowance = options.sprinting ? allowance.run : allowance.walk;
    const remainingAllowance = Math.min(modeAllowance, combatant.movementBudget.remaining);
    return movementToReach(combatant, target, options) <= remainingAllowance;
}

export function applyMove(
    state: CombatState,
    combatantId: string,
    target: MoveTarget,
    mode: MovementMode,
    _rng: Rng = mathRandomRng,
    options: { thresholds?: RangeBandThresholds } = {}
): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    const to = resolveMoveTargetPosition(state, combatant, target, options.thresholds ?? DEFAULT_RANGE_THRESHOLDS);
    const distance = Math.abs(to - combatant.position);
    const actionSpent = mode === 'sprint';
    const reject = (
        reason: 'engaged' | 'noMove' | 'noAction' | 'insufficientBudget' | 'fearApproach',
        priorEvents: CombatEngineResult['events'] = []
    ): CombatEngineResult => ({
        state,
        events: [...priorEvents, {
            type: 'MoveRejectedEvent',
            i18nKey: `combat.movement.rejected.${reason}`,
            data: {
                combatantId: combatant.id,
                combatantName: combatant.name,
                mode,
                from: combatant.position,
                to,
                distance,
                reason,
            },
        }],
    });

    if (combatant.budget.moves <= 0) return reject('noMove');
    if (actionSpent && combatant.budget.actions <= 0) return reject('noAction');

    const allowance = getWalkRun(combatant);
    const maxDistance = Math.min(mode === 'walk' ? allowance.walk : allowance.run, combatant.movementBudget.remaining);
    if (distance > maxDistance) return reject('insufficientBudget');
    const approach = resolveVoluntaryFearApproach(state, combatant.id, to, _rng);
    if (!approach.allowed) return reject('fearApproach', approach.events);

    const chargedIntoMelee = mode === 'charge'
        && typeof target === 'object'
        && 'combatantId' in target
        && !combatant.engagementIds.includes(target.combatantId);
    const updatedCombatant: Combatant = {
        ...combatant,
        position: to,
        movementBudget: {
            ...combatant.movementBudget,
            remaining: Math.max(0, combatant.movementBudget.remaining - distance),
        },
        budget: {
            ...combatant.budget,
            actions: actionSpent ? combatant.budget.actions - 1 : combatant.budget.actions,
            moves: combatant.budget.moves - 1,
        },
    };

    const movedState = replaceCombatants({
        ...state,
        turnFlags: {
            ...state.turnFlags,
            chargedCombatantIds: chargedIntoMelee
                ? [...new Set([...state.turnFlags.chargedCombatantIds, combatant.id])]
                : state.turnFlags.chargedCombatantIds,
        },
        advantagePools: chargedIntoMelee ? {
            ...state.advantagePools,
            [combatant.side]: state.advantagePools[combatant.side] + 1,
        } : state.advantagePools,
    }, [updatedCombatant]);
    const events: CombatEngineResult['events'] = [{
            type: 'MovedEvent',
            i18nKey: 'combat.movement.moved',
            data: {
                combatantId: combatant.id,
                combatantName: combatant.name,
                mode,
                from: combatant.position,
                to,
                distance,
                actionSpent,
                remainingMovement: updatedCombatant.movementBudget.remaining,
            },
        }];

    if (chargedIntoMelee) {
        events.push({
            type: 'AdvantageChanged',
            i18nKey: 'combat.advantage.changed',
            data: {
                side: combatant.side,
                delta: 1,
                poolBefore: state.advantagePools[combatant.side],
                poolAfter: movedState.advantagePools[combatant.side],
                total: movedState.advantagePools[combatant.side],
                reason: 'condition',
                sourceCombatantId: combatant.id,
            },
        });
    }

    const approachResult = resolveSourceApproachFear(state, movedState, combatant.id, _rng);
    return { state: approachResult.state, events: [...events, ...approachResult.events] };
}

export function engage(state: CombatState, aId: string, bId: string): CombatEngineResult {
    const a = getCombatant(state, aId);
    const b = getCombatant(state, bId);
    const updatedA = { ...a, engagementIds: addUnique(a.engagementIds, b.id) };
    const updatedB = { ...b, engagementIds: addUnique(b.engagementIds, a.id) };

    return {
        state: replaceCombatants(state, [updatedA, updatedB]),
        events: [{
            type: 'EngagedEvent',
            i18nKey: 'combat.engagement.engaged',
            data: {
                aId: a.id,
                bId: b.id,
                aName: a.name,
                bName: b.name,
                distance: distanceBetween(a, b),
            },
        }],
    };
}

export function disengage(state: CombatState, combatantId: string): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    const disengagedFromIds = [...combatant.engagementIds];
    if (disengagedFromIds.length === 0) {
        return { state, events: [] };
    }

    const updatedCombatant: Combatant = {
        ...combatant,
        engagementIds: [],
        budget: {
            ...combatant.budget,
            actions: Math.max(0, combatant.budget.actions - 1),
        },
    };

    const updatedOthers = disengagedFromIds.map(id => {
        const other = getCombatant(state, id);
        return {
            ...other,
            engagementIds: other.engagementIds.filter(engagedId => engagedId !== combatant.id),
        };
    });

    return {
        state: replaceCombatants(state, [updatedCombatant, ...updatedOthers]),
        events: [{
            type: 'DisengagedEvent',
            i18nKey: 'combat.engagement.disengaged',
            data: {
                combatantId: combatant.id,
                combatantName: combatant.name,
                disengagedFromIds,
                actionSpent: true,
            },
        }],
    };
}

export function outnumberingFor(combatantId: string, state: CombatState): number {
    const combatant = getCombatant(state, combatantId);
    const groupIds = engagementGroupIds(state, combatantId);
    return [...groupIds].filter(id => {
        if (id === combatantId) return false;
        const other = state.combatants[id];
        return other !== undefined && other.side !== combatant.side;
    }).length;
}

export function reachOf(combatant: Combatant, weapons: Weapon[] = []): ReachInfo {
    const weaponById = new Map(weapons.map(weapon => [weapon.id, weapon]));
    const equippedWeapons = Object.entries(combatant.character.inventory.equippedWeapons || {})
        .filter(([, equipped]) => equipped)
        .map(([weaponId]) => weaponId);
    const candidateWeaponIds = equippedWeapons.length > 0
        ? equippedWeapons
        : Object.entries(combatant.character.inventory.weapons || {})
            .filter(([, count]) => count > 0)
            .map(([weaponId]) => weaponId);

    const best = candidateWeaponIds
        .map(weaponId => weaponById.get(weaponId))
        .filter((weapon): weapon is Weapon => weapon !== undefined)
        .map(weapon => ({
            reach: normalizeReach(weapon.reach),
            rank: REACH_RANK[normalizeReach(weapon.reach)],
            weaponId: weapon.id,
            weaponName: weapon.name,
        }))
        .sort((a, b) => b.rank - a.rank)[0];

    return best ?? { reach: 'Personal', rank: REACH_RANK.Personal, weaponName: 'Unarmed' };
}

export function reachOrder(state: CombatState, aId: string, bId: string, weapons: Weapon[] = state.weapons): ReachOrderHint {
    const a = getCombatant(state, aId);
    const b = getCombatant(state, bId);
    const aReach = reachOf(a, weapons);
    const bReach = reachOf(b, weapons);

    if (aReach.rank === bReach.rank) {
        return {
            order: [a.id, b.id],
            tied: true,
            reaches: { [a.id]: aReach, [b.id]: bReach },
        };
    }

    const first = aReach.rank > bReach.rank ? a.id : b.id;
    const second = first === a.id ? b.id : a.id;
    return {
        order: [first, second],
        firstCombatantId: first,
        tied: false,
        reaches: { [a.id]: aReach, [b.id]: bReach },
    };
}

export function engagementKey(aId: string, bId: string): string {
    return [aId, bId].sort().join(':');
}

export function isEngagedWith(state: CombatState, aId: string, bId: string): boolean {
    const combatant = state.combatants[aId];
    return !!combatant?.engagementIds.includes(bId);
}

export function isInfighting(
    state: CombatState,
    aId: string,
    bId: string,
    _weapons: Weapon[] = state.weapons,
    _thresholds: RangeBandThresholds = DEFAULT_RANGE_THRESHOLDS
): boolean {
    const key = engagementKey(aId, bId);
    if (state.engagements[key]?.infightingMode) return true;
    return false;
}

function resolveMoveTargetPosition(state: CombatState, combatant: Combatant, target: MoveTarget, thresholds: RangeBandThresholds): number {
    if (typeof target === 'number') return target;
    if ('position' in target) return target.position;

    const targetCombatant = getCombatant(state, target.combatantId);
    if (Math.abs(combatant.position - targetCombatant.position) <= thresholds.engaged) {
        return combatant.position;
    }

    if (combatant.position < targetCombatant.position) {
        return targetCombatant.position - thresholds.engaged;
    }

    return targetCombatant.position + thresholds.engaged;
}

function engagementGroupIds(state: CombatState, combatantId: string): Set<string> {
    const visited = new Set<string>();
    const queue = [combatantId];

    while (queue.length > 0) {
        const id = queue.shift();
        if (!id || visited.has(id)) continue;
        visited.add(id);

        const combatant = state.combatants[id];
        if (!combatant) continue;
        for (const engagedId of combatant.engagementIds) {
            if (!visited.has(engagedId)) queue.push(engagedId);
        }
    }

    return visited;
}

function normalizeReach(reach: string | undefined): WeaponReach {
    const normalized = (reach || 'Personal').trim().toLowerCase();
    if (normalized === 'n/a') return 'N/A';
    if (normalized === 'personal') return 'Personal';
    if (normalized === 'very short') return 'Very Short';
    if (normalized === 'short') return 'Short';
    if (normalized === 'average') return 'Average';
    if (normalized === 'long') return 'Long';
    if (normalized === 'very long') return 'Very Long';
    if (normalized === 'varies') return 'Varies';
    return 'Personal';
}

function addUnique(ids: string[], id: string): string[] {
    return [...new Set([...ids, id])];
}

function getCombatant(state: CombatState, combatantId: string): Combatant {
    const combatant = state.combatants[combatantId];
    if (!combatant) {
        throw new Error(`Combatant not found: ${combatantId}`);
    }

    return combatant;
}

function replaceCombatants(state: CombatState, combatants: Combatant[]): CombatState {
    return {
        ...state,
        combatants: {
            ...state.combatants,
            ...Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        },
    };
}
