import { calculateSuccessLevel, rolld100 } from '../utils/mechanics';
import { calculateCharacteristicValue } from '../utils/skills';
import { mathRandomRng, type Rng } from './rng';
import { outnumberingFor } from './spatial';
import type {
    AdvantagePools,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    SideId,
} from './types';

export type AdvantageSpendAction = 'batter' | 'trick' | 'additionalEffort' | 'fleeFromHarm' | 'additionalAction';
export type AdvantageSeedCategory = 'manoeuvrability' | 'outnumbering' | 'surprise' | 'terrain' | 'threat';

export interface AdvantageSeedModifier {
    side: SideId;
    value: number;
    source?: string;
}

export interface InitialAdvantageConfig {
    state?: CombatState;
    manoeuvrability?: AdvantageSeedModifier | AdvantageSeedModifier[];
    outnumbering?: AdvantageSeedModifier | AdvantageSeedModifier[];
    surprise?: AdvantageSeedModifier | AdvantageSeedModifier[];
    terrain?: AdvantageSeedModifier | AdvantageSeedModifier[];
    threat?: AdvantageSeedModifier | AdvantageSeedModifier[];
}

export interface SpendAdvantageParams {
    actorId?: string;
    targetId?: string;
    actorRoll?: number;
    targetRoll?: number;
    actorTargetNumber?: number;
    targetTargetNumber?: number;
    amount?: number;
    pendingTestId?: string;
    conditionId?: 'condition_ablaze' | 'condition_blinded' | 'condition_entangled';
}

const EMPTY_POOLS: AdvantagePools = { ally: 0, adversary: 0 };

export const advantageTalentAudit = [
    'beat-blade',
    'beneath-notice',
    'distract',
    'drilled',
    'dual-wielder',
    'furious-assault',
    'rapid-reload',
    'strong-minded',
    'warleader',
    'shieldman',
] as const;

export function createAdvantagePools(pools: Partial<AdvantagePools> = {}): AdvantagePools {
    return {
        ally: pools.ally ?? 0,
        adversary: pools.adversary ?? 0,
    };
}

export function opposingSide(side: SideId): SideId {
    return side === 'ally' ? 'adversary' : 'ally';
}

export function grantAdvantage(
    state: CombatState,
    side: SideId,
    amount: number,
    options: { reason?: 'opposedTestWin' | 'spendActionWin' | 'spendActionLoss' | 'seed' | 'reallocation' | 'condition' | 'manual'; sourceCombatantId?: string } = {}
): CombatEngineResult {
    const poolBefore = state.advantagePools[side];
    const poolAfter = Math.max(0, poolBefore + amount);
    const nextState = {
        ...state,
        advantagePools: {
            ...state.advantagePools,
            [side]: poolAfter,
        },
    };

    return {
        state: nextState,
        events: [{
            type: 'AdvantageChanged',
            i18nKey: 'combat.advantage.changed',
            data: {
                side,
                delta: poolAfter - poolBefore,
                poolBefore,
                poolAfter,
                total: poolAfter,
                reason: options.reason ?? 'manual',
                sourceCombatantId: options.sourceCombatantId,
            },
        }],
    };
}

export function seedInitialAdvantage(config: InitialAdvantageConfig): AdvantagePools {
    const pools = createAdvantagePools();
    const categories: AdvantageSeedCategory[] = ['manoeuvrability', 'outnumbering', 'surprise', 'terrain', 'threat'];

    for (const category of categories) {
        const candidates = normalizeSeedModifiers(config[category]);
        if (category === 'outnumbering' && config.state) {
            const outnumbering = computeOutnumberingSeed(config.state);
            if (outnumbering) candidates.push(outnumbering);
        }

        const winner = highestSingleBeneficiary(candidates);
        if (winner) {
            pools[winner.side] += winner.value;
        }
    }

    return pools;
}

export function reallocateEndOfRound(state: CombatState): CombatEngineResult {
    const dominantSide = dominantLivingSide(state);
    if (!dominantSide) {
        return {
            state,
            events: [{
                type: 'AdvantageReallocatedEvent',
                i18nKey: 'combat.advantage.reallocated.none',
                data: {
                    reason: 'noDominantSide',
                    transferred: false,
                    pools: state.advantagePools,
                },
            }],
        };
    }

    const suppressedSide = opposingSide(dominantSide);
    const nextPools = { ...state.advantagePools };
    if (nextPools[suppressedSide] > 0) {
        nextPools[suppressedSide] -= 1;
        nextPools[dominantSide] += 1;
    } else {
        nextPools[dominantSide] += 1;
    }

    const nextState = { ...state, advantagePools: nextPools };
    return {
        state: nextState,
        events: [{
            type: 'AdvantageReallocatedEvent',
            i18nKey: 'combat.advantage.reallocated.changed',
            data: {
                dominantSide,
                suppressedSide,
                reason: livingCounts(state).ally === livingCounts(state).adversary ? 'tacticalTie' : 'livingCombatants',
                transferred: true,
                pools: nextPools,
            },
        }],
    };
}

export function spendAdvantage(
    state: CombatState,
    side: SideId,
    action: AdvantageSpendAction,
    params: SpendAdvantageParams = {},
    rng: Rng = mathRandomRng
): CombatEngineResult {
    const cost = advantageCost(action, params);
    const available = state.advantagePools[side];
    const reject = (reason: 'insufficientAdvantage' | 'missingActor' | 'missingTarget' | 'alreadyUsedThisTurn' | 'invalidAmount'): CombatEngineResult => ({
        state,
        events: [{
            type: 'AdvantageSpendRejectedEvent',
            i18nKey: `combat.advantage.spendRejected.${reason}`,
            data: { side, action, cost, available, reason },
        }],
    });

    if (cost <= 0 || (action === 'additionalEffort' && cost < 2)) return reject('invalidAmount');
    if (available < cost) return reject('insufficientAdvantage');
    if ((action === 'batter' || action === 'trick' || action === 'additionalAction' || action === 'fleeFromHarm') && !params.actorId) return reject('missingActor');
    if ((action === 'batter' || action === 'trick') && !params.targetId) return reject('missingTarget');
    if (action === 'additionalAction' && state.turnFlags.additionalActionCombatantIds.includes(params.actorId!)) return reject('alreadyUsedThisTurn');

    let currentState = spendFromPool(state, side, cost);
    const events: CombatEvent[] = [{
        type: 'AdvantageSpentEvent',
        i18nKey: 'combat.advantage.spent',
        data: {
            side,
            action,
            amount: cost,
            poolBefore: available,
            poolAfter: currentState.advantagePools[side],
            actorId: params.actorId,
        },
    }];

    if (action === 'additionalEffort') {
        events.push({
            type: 'AdvantageModifierPreparedEvent',
            i18nKey: 'combat.advantage.additionalEffort',
            data: {
                side,
                action,
                amount: cost,
                modifier: (cost - 1) * 10,
                pendingTestId: params.pendingTestId,
                actorId: params.actorId,
                generatesAdvantage: false,
            },
        });
        return { state: currentState, events };
    }

    if (action === 'additionalAction') {
        const actor = getCombatant(currentState, params.actorId!);
        currentState = replaceCombatants(currentState, [{
            ...actor,
            budget: { ...actor.budget, actions: actor.budget.actions + 1 },
        }], {
            ...currentState.turnFlags,
            additionalActionCombatantIds: [...currentState.turnFlags.additionalActionCombatantIds, actor.id],
        });
        events.push(actionEvent(side, action, 'applied', params.actorId));
        return { state: currentState, events };
    }

    if (action === 'fleeFromHarm') {
        const fleeResult = clearEngagements(currentState, params.actorId!);
        currentState = fleeResult.state;
        events.push(...fleeResult.events, actionEvent(side, action, 'applied', params.actorId));
        return { state: currentState, events };
    }

    const opposed = resolveAdvantageOpposedTest(currentState, action, params, rng);
    const actorWon = opposed.actorSuccessLevel > opposed.targetSuccessLevel
        || (opposed.actorSuccessLevel === opposed.targetSuccessLevel && opposed.actorTargetNumber > opposed.targetTargetNumber);
    const winnerSide = actorWon ? side : opposingSide(side);

    if (actorWon && action === 'batter') {
        currentState = applyCondition(currentState, params.targetId!, 'condition_prone');
        events.push({ type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: params.targetId!, conditionId: 'condition_prone', stacks: 1 } });
    }

    if (actorWon && action === 'trick' && params.conditionId) {
        currentState = applyCondition(currentState, params.targetId!, params.conditionId);
        events.push({ type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: params.targetId!, conditionId: params.conditionId, stacks: 1 } });
    }

    const grantResult = grantAdvantage(currentState, winnerSide, 1, {
        reason: actorWon ? 'spendActionWin' : 'spendActionLoss',
        sourceCombatantId: params.actorId,
    });
    currentState = grantResult.state;
    events.push(actionEvent(side, action, actorWon ? 'win' : 'loss', params.actorId, params.targetId, opposed), ...grantResult.events);

    return { state: currentState, events };
}

function advantageCost(action: AdvantageSpendAction, params: SpendAdvantageParams): number {
    if (action === 'additionalEffort') return params.amount ?? 2;
    if (action === 'additionalAction') return 4;
    if (action === 'fleeFromHarm') return 2;
    return 1;
}

function spendFromPool(state: CombatState, side: SideId, amount: number): CombatState {
    return {
        ...state,
        advantagePools: {
            ...state.advantagePools,
            [side]: state.advantagePools[side] - amount,
        },
    };
}

function normalizeSeedModifiers(input: AdvantageSeedModifier | AdvantageSeedModifier[] | undefined): AdvantageSeedModifier[] {
    if (!input) return [];
    return Array.isArray(input) ? [...input] : [input];
}

function highestSingleBeneficiary(candidates: AdvantageSeedModifier[]): AdvantageSeedModifier | null {
    const valid = candidates.filter(candidate => candidate.value > 0);
    if (valid.length === 0) return null;

    const highestValue = Math.max(...valid.map(candidate => candidate.value));
    const highest = valid.filter(candidate => candidate.value === highestValue);
    const sides = new Set(highest.map(candidate => candidate.side));
    if (sides.size > 1) return null;
    return highest[0];
}

function computeOutnumberingSeed(state: CombatState): AdvantageSeedModifier | null {
    const bestBySide: AdvantagePools = createAdvantagePools();
    for (const combatant of Object.values(state.combatants).filter(isLiving)) {
        const enemyCount = outnumberingFor(combatant.id, state);
        if (enemyCount === 0) continue;

        const friendlyCount = Object.values(state.combatants).filter(other => (
            isLiving(other)
            && other.side === combatant.side
            && (other.id === combatant.id || combatant.engagementIds.some(id => state.combatants[id]?.side !== combatant.side))
        )).length;
        const value = friendlyCount - enemyCount;
        if (value > bestBySide[combatant.side]) {
            bestBySide[combatant.side] = value;
        }
    }

    if (bestBySide.ally === bestBySide.adversary) return null;
    const side = bestBySide.ally > bestBySide.adversary ? 'ally' : 'adversary';
    return bestBySide[side] > 0 ? { side, value: bestBySide[side], source: 'outnumbering' } : null;
}

function dominantLivingSide(state: CombatState): SideId | null {
    const counts = livingCounts(state);
    if (counts.ally > counts.adversary) return 'ally';
    if (counts.adversary > counts.ally) return 'adversary';
    return state.tacticalDominantSide ?? null;
}

function livingCounts(state: CombatState): AdvantagePools {
    return Object.values(state.combatants).filter(isLiving).reduce((counts, combatant) => ({
        ...counts,
        [combatant.side]: counts[combatant.side] + 1,
    }), createAdvantagePools());
}

function isLiving(combatant: Combatant): boolean {
    return combatant.currentWounds > 0;
}

function resolveAdvantageOpposedTest(state: CombatState, action: 'batter' | 'trick', params: SpendAdvantageParams, rng: Rng) {
    const actor = getCombatant(state, params.actorId!);
    const target = getCombatant(state, params.targetId!);
    const characteristic = action === 'batter' ? 's' : 'ag';
    const actorTargetNumber = params.actorTargetNumber ?? calculateCharacteristicValue(actor.character.characteristics[characteristic]);
    const targetTargetNumber = params.targetTargetNumber ?? calculateCharacteristicValue(target.character.characteristics[characteristic]);
    const actorRoll = params.actorRoll ?? rolld100(rng);
    const targetRoll = params.targetRoll ?? rolld100(rng);

    return {
        actorRoll,
        targetRoll,
        actorTargetNumber,
        targetTargetNumber,
        actorSuccessLevel: Math.round(calculateSuccessLevel(actorRoll, actorTargetNumber)),
        targetSuccessLevel: Math.round(calculateSuccessLevel(targetRoll, targetTargetNumber)),
    };
}

function actionEvent(
    side: SideId,
    action: AdvantageSpendAction,
    outcome: 'win' | 'loss' | 'applied',
    actorId?: string,
    targetId?: string,
    opposed?: ReturnType<typeof resolveAdvantageOpposedTest>
): CombatEvent {
    return {
        type: 'AdvantageActionResolvedEvent',
        i18nKey: `combat.advantage.action.${action}.${outcome}`,
        data: {
            side,
            action,
            outcome,
            actorId,
            targetId,
            actorRoll: opposed?.actorRoll,
            targetRoll: opposed?.targetRoll,
            actorSuccessLevel: opposed?.actorSuccessLevel,
            targetSuccessLevel: opposed?.targetSuccessLevel,
            generatesAdvantage: false,
        },
    };
}

function applyCondition(state: CombatState, combatantId: string, conditionId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    if (['condition_prone', 'condition_surprised', 'condition_unconscious'].includes(conditionId) && combatant.conditions.includes(conditionId)) {
        return state;
    }
    return replaceCombatants(state, [{ ...combatant, conditions: [...combatant.conditions, conditionId] }]);
}

function clearEngagements(state: CombatState, combatantId: string): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    const disengagedFromIds = [...combatant.engagementIds];
    const updatedCombatant = { ...combatant, engagementIds: [] };
    const updatedOthers = disengagedFromIds.map(id => {
        const other = getCombatant(state, id);
        return { ...other, engagementIds: other.engagementIds.filter(engagedId => engagedId !== combatantId) };
    });

    return {
        state: replaceCombatants(state, [updatedCombatant, ...updatedOthers]),
        events: disengagedFromIds.length === 0 ? [] : [{
            type: 'DisengagedEvent',
            i18nKey: 'combat.engagement.disengaged',
            data: {
                combatantId,
                combatantName: combatant.name,
                disengagedFromIds,
                actionSpent: false,
            },
        }],
    };
}

function getCombatant(state: CombatState, combatantId: string): Combatant {
    const combatant = state.combatants[combatantId];
    if (!combatant) {
        throw new Error(`Combatant not found: ${combatantId}`);
    }

    return combatant;
}

function replaceCombatants(state: CombatState, combatants: Combatant[], turnFlags = state.turnFlags): CombatState {
    return {
        ...state,
        turnFlags,
        combatants: {
            ...state.combatants,
            ...Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        },
    };
}
