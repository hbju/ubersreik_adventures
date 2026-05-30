import { calculateSuccessLevel } from '../utils/mechanics';
import { mathRandomRng, type Rng } from './rng';
import type {
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    FateSpendAction,
    FortuneSpendAction,
    ResolvedOpposedRoll,
    ResourceSpendPolicy,
} from './types';

export const DEFAULT_FORTUNE_POLICY: ResourceSpendPolicy = 'stub';
export const DEFAULT_FATE_POLICY: ResourceSpendPolicy = 'stub';

export interface SpendFortuneParams {
    pendingTestId?: string;
    rollResult?: number;
    targetNumber?: number;
    policy?: ResourceSpendPolicy;
}

export interface SpendFateParams {
    policy?: ResourceSpendPolicy;
    incomingDamage?: number;
    deathReason?: string;
}

export interface FortunePostRollHook {
    slBonus?: number;
    reroll?: boolean;
    rerollResult?: number;
}

export function spendFortune(
    state: CombatState,
    combatantId: string,
    action: FortuneSpendAction,
    params: SpendFortuneParams = {},
    rng: Rng = mathRandomRng
): CombatEngineResult {
    const policy = params.policy ?? DEFAULT_FORTUNE_POLICY;
    const combatant = getCombatant(state, combatantId);
    const fortune = combatant.resources.fortune;
    const reject = (reason: 'insufficientFortune' | 'policyRejected' | 'missingActor' | 'testAlreadySucceeded'): CombatEngineResult => ({
        state,
        events: [{
            type: 'FortuneSpendRejectedEvent',
            i18nKey: `combat.fortune.spendRejected.${reason}`,
            data: { combatantId, action, reason },
        }],
    });

    if (policy === 'never') return reject('policyRejected');
    if (!fortune || fortune.current <= 0) return reject('insufficientFortune');

    if (action === 'reroll') {
        if (params.rollResult !== undefined && params.targetNumber !== undefined) {
            const successLevel = Math.round(calculateSuccessLevel(params.rollResult, params.targetNumber));
            if (successLevel >= 0) return reject('testAlreadySucceeded');
        }
    }

    const nextFortune = Math.max(0, fortune.current - 1);
    let currentState = replaceCombatant(state, syncFortune(combatant, nextFortune, fortune.max));
    const events: CombatEvent[] = [{
        type: 'ResourceSpent',
        i18nKey: 'combat.fortune.spent',
        data: {
            combatantId,
            resource: 'fortune',
            amount: 1,
            remaining: nextFortune,
            spendAction: action,
        },
    }];

    if (action === 'reroll') {
        events.push({
            type: 'FortuneModifierPreparedEvent',
            i18nKey: 'combat.fortune.reroll',
            data: {
                combatantId,
                action,
                pendingTestId: params.pendingTestId,
                reroll: true,
            },
        });
        return { state: currentState, events };
    }

    if (action === 'plusOneSl') {
        events.push({
            type: 'FortuneModifierPreparedEvent',
            i18nKey: 'combat.fortune.plusOneSl',
            data: {
                combatantId,
                action,
                pendingTestId: params.pendingTestId,
                slBonus: 1,
            },
        });
        return { state: currentState, events };
    }

    currentState = replaceCombatant(currentState, {
        ...getCombatant(currentState, combatantId),
        initiativeOverride: true,
    });
    events.push({
        type: 'FortuneModifierPreparedEvent',
        i18nKey: 'combat.fortune.actFirst',
        data: {
            combatantId,
            action,
            actFirst: true,
        },
    });
    return { state: currentState, events };
}

export function spendFate(
    state: CombatState,
    combatantId: string,
    action: FateSpendAction,
    params: SpendFateParams = {}
): CombatEngineResult {
    const policy = params.policy ?? DEFAULT_FATE_POLICY;
    const combatant = getCombatant(state, combatantId);
    const fate = combatant.resources.fate;
    const reject = (reason: 'insufficientFate' | 'policyRejected' | 'missingActor' | 'notApplicable'): CombatEngineResult => ({
        state,
        events: [{
            type: 'FateSpendRejectedEvent',
            i18nKey: `combat.fate.spendRejected.${reason}`,
            data: { combatantId, action, reason },
        }],
    });

    if (policy === 'never') return reject('policyRejected');
    if (!fate || fate.current <= 0) return reject('insufficientFate');

    const nextFate = Math.max(0, fate.current - 1);
    const nextMax = Math.max(0, fate.max - 1);
    const updated = syncFate(combatant, nextFate, nextMax);
    const events: CombatEvent[] = [{
        type: 'ResourceSpent',
        i18nKey: 'combat.fate.spent',
        data: {
            combatantId,
            resource: 'fate',
            amount: 1,
            remaining: nextFate,
            spendAction: action,
        },
    }];

    return { state: replaceCombatant(state, updated), events };
}

export function applyFortunePostRollHook(
    roll: ResolvedOpposedRoll,
    hook: FortunePostRollHook | undefined
): ResolvedOpposedRoll {
    if (!hook) return roll;
    if (hook.reroll && hook.rerollResult !== undefined) {
        const successLevel = calculateSuccessLevel(hook.rerollResult, roll.targetNumber);
        return {
            ...roll,
            rollResult: hook.rerollResult,
            successLevel,
            roundedSuccessLevel: Math.round(successLevel),
        };
    }
    if (hook.slBonus) {
        const successLevel = roll.successLevel + hook.slBonus;
        return {
            ...roll,
            successLevel,
            roundedSuccessLevel: Math.round(successLevel),
        };
    }
    return roll;
}

export function tryInterceptDamageWithFate(
    state: CombatState,
    combatantId: string,
    damageDealt: number,
    policy: ResourceSpendPolicy = DEFAULT_FATE_POLICY
): CombatEngineResult & { intercepted?: boolean; damageDealt?: number } {
    if (damageDealt <= 0) return { state, events: [], intercepted: false, damageDealt };
    const combatant = getCombatant(state, combatantId);
    const fate = combatant.resources.fate;
    if (!fate || fate.current <= 0) return { state, events: [], intercepted: false, damageDealt };

    if (policy === 'never') return { state, events: [], intercepted: false, damageDealt };
    if (policy === 'stub') {
        return { state, events: [], intercepted: false, damageDealt };
    }

    const spent = spendFate(state, combatantId, 'howDidThatMiss', { policy: 'always' });
    return {
        state: spent.state,
        events: [
            ...spent.events,
            {
                type: 'FateInterceptionEvent',
                i18nKey: 'combat.fate.howDidThatMiss',
                data: {
                    combatantId,
                    action: 'howDidThatMiss',
                    intercepted: 'damage',
                    damageNegated: damageDealt,
                },
            },
        ],
        intercepted: true,
        damageDealt: 0,
    };
}

export function tryInterceptDeathWithFate(
    state: CombatState,
    combatantId: string,
    policy: ResourceSpendPolicy = DEFAULT_FATE_POLICY
): CombatEngineResult & { intercepted?: boolean } {
    const combatant = getCombatant(state, combatantId);
    const fate = combatant.resources.fate;
    if (!fate || fate.current <= 0) return { state, events: [], intercepted: false };

    if (policy === 'never') return { state, events: [], intercepted: false };
    if (policy === 'stub') return { state, events: [], intercepted: false };

    const spent = spendFate(state, combatantId, 'dieAnotherDay', { policy: 'always' });
    const updated = replaceCombatant(spent.state, {
        ...getCombatant(spent.state, combatantId),
        removedFromEncounter: true,
        conditions: addCondition(getCombatant(spent.state, combatantId).conditions, 'condition_unconscious'),
    });

    return {
        state: updated,
        events: [
            ...spent.events,
            {
                type: 'FateInterceptionEvent',
                i18nKey: 'combat.fate.dieAnotherDay',
                data: {
                    combatantId,
                    action: 'dieAnotherDay',
                    intercepted: 'death',
                    removedFromEncounter: true,
                },
            },
            {
                type: 'CombatantRemovedFromEncounter',
                i18nKey: 'combat.fate.removedFromEncounter',
                data: { combatantId, reason: 'dieAnotherDay' },
            },
        ],
        intercepted: true,
    };
}

export function enforceFortuneCap(combatant: Combatant): Combatant {
    const fateMax = combatant.resources.fate?.max ?? combatant.resources.fortune?.max ?? 0;
    const fortune = combatant.resources.fortune;
    if (!fortune) return combatant;
    const cappedMax = Math.min(fortune.max, fateMax);
    const cappedCurrent = Math.min(fortune.current, cappedMax);
    return syncFortune(combatant, cappedCurrent, cappedMax);
}

function syncFortune(combatant: Combatant, current: number, max: number): Combatant {
    return {
        ...combatant,
        character: {
            ...combatant.character,
            status: {
                ...combatant.character.status,
                fortune: { current, max },
            },
        },
        resources: {
            ...combatant.resources,
            fortune: { current, max },
        },
    };
}

function syncFate(combatant: Combatant, current: number, max: number): Combatant {
    const next = {
        ...combatant,
        character: {
            ...combatant.character,
            status: {
                ...combatant.character.status,
                fate: { current, max },
            },
        },
        resources: {
            ...combatant.resources,
            fate: { current, max },
        },
    };
    return enforceFortuneCap(next);
}

function addCondition(conditions: string[], conditionId: string): string[] {
    if (conditions.includes(conditionId)) return conditions;
    return [...conditions, conditionId];
}

function getCombatant(state: CombatState, combatantId: string): Combatant {
    const combatant = state.combatants[combatantId];
    if (!combatant) throw new Error(`Combatant not found: ${combatantId}`);
    return combatant;
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
