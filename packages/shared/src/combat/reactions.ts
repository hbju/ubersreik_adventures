import { calculateSuccessLevel } from '../utils/mechanics';
import { grantAdvantage } from './advantage';
import { resolveDamage } from './engine';
import { hasQuality } from './qualities';
import { spendFate, spendFortune, tryInterceptDeathWithFate } from './resources';
import { type Rng } from './rng';
import { resolveShieldsmanActivation } from './talent-actions';
import type {
    AttackResolvedEvent,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
    ReactionKind,
    ReactionTrigger,
    ResolvedOpposedRoll,
} from './types';

export interface ReactionDecision {
    kind: 'reaction';
    actorId: string;
    reaction: ReactionKind;
    trigger: ReactionTrigger;
    targetId?: string;
    rollResult?: number;
    targetNumber?: number;
    policy?: 'always' | 'never';
}

export interface ReactionWindowContext {
    trigger: ReactionTrigger;
    actorId: string;
    targetId?: string;
    attackEvent?: AttackResolvedEvent;
    testRoll?: ResolvedOpposedRoll;
    incomingDamage?: number;
    depth?: number;
}

const MAX_REACTION_DEPTH = 8;

export function eligibleReactions(state: CombatState, context: ReactionWindowContext): ReactionDecision[] {
    const actor = state.combatants[context.actorId];
    if (!actor) return [];
    const targetId = context.targetId;
    const choices: ReactionDecision[] = [];

    if (context.trigger === 'charged' && targetId && hasTalent(actor, 'reaction-strike') && actor.budget.reactions > 0) {
        const key = reactionStrikeKey(targetId, actor.id);
        if (!state.turnFlags.reactionStrikeChargerPairs.includes(key)) {
            choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'reactionStrike', trigger: context.trigger });
        }
    }

    if (context.trigger === 'won-defensive-Melee' && targetId && actor.budget.reactions > 0) {
        if (hasTalent(actor, 'riposte') && equippedWeapons(actor, state).some(weapon => hasQuality(weapon, 'fast'))) {
            choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'riposte', trigger: context.trigger });
        }
        if (hasTalent(actor, 'shieldsman') && state.advantagePools[actor.side] >= 2 && equippedWeapons(actor, state).some(weapon => hasQuality(weapon, 'shield'))) {
            choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'shieldsman', trigger: context.trigger });
        }
        if (hasTalent(actor, 'reversal') && state.advantagePools[state.combatants[targetId]?.side ?? actor.side] > 0) {
            choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'reversal', trigger: context.trigger });
        }
    }

    if (context.trigger === 'won-Dodge-defence' && actor.budget.reactions > 0) {
        choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'stepAside', trigger: context.trigger });
    }

    if (context.trigger === 'scored-a-defensive-crit' && targetId && state.advantagePools[actor.side] > 0) {
        const attack = context.attackEvent?.data;
        if (attack?.defenderRoll?.weaponId && equippedWeapons(actor, state).some(weapon => weapon.id === attack.defenderRoll.weaponId && hasQuality(weapon, 'slash'))) {
            choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'slashExtraBleeding', trigger: context.trigger });
        }
    }

    if (context.trigger === 'damage-about-to-apply' && (actor.resources.fate?.current ?? 0) > 0 && (context.incomingDamage ?? 0) > 0) {
        choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'howDidThatMiss', trigger: context.trigger });
    }

    if (context.trigger === 'would-die' && (actor.resources.fate?.current ?? 0) > 0) {
        choices.push({ kind: 'reaction', actorId: actor.id, targetId, reaction: 'dieAnotherDay', trigger: context.trigger });
    }

    if (context.trigger === 'test-failed' && (actor.resources.fortune?.current ?? 0) > 0 && context.testRoll && context.testRoll.roundedSuccessLevel < 0) {
        choices.push({ kind: 'reaction', actorId: actor.id, reaction: 'fortuneReroll', trigger: context.trigger });
    }

    if (context.trigger === 'test-rolled' && (actor.resources.fortune?.current ?? 0) > 0 && context.testRoll) {
        choices.push({ kind: 'reaction', actorId: actor.id, reaction: 'fortunePlusOneSl', trigger: context.trigger });
    }

    return choices;
}

export function resolveReactionDecision(
    state: CombatState,
    decision: ReactionDecision,
    context: ReactionWindowContext,
    rng: Rng
): CombatEngineResult {
    const depth = context.depth ?? 0;
    if (depth >= MAX_REACTION_DEPTH) {
        return { state, events: [reactionResolved(decision, false, depth, { capped: true })] };
    }
    if (decision.policy === 'never') {
        return { state, events: [reactionResolved(decision, false, depth)] };
    }

    switch (decision.reaction) {
        case 'riposte':
            return consumeReaction(resolveRiposteDamage(state, decision.actorId, decision.targetId, rng), decision.actorId, decision, depth);
        case 'reactionStrike':
            return consumeReaction(resolveReactionStrike(state, decision, rng), decision.actorId, decision, depth);
        case 'stepAside':
            return consumeReaction(resolveStepAside(state, decision.actorId), decision.actorId, decision, depth);
        case 'shieldsman':
            if (!decision.targetId) return { state, events: [reactionResolved(decision, false, depth)] };
            return consumeReaction(resolveShieldsmanActivation(state, decision.actorId, decision.targetId, 'damage', 'always'), decision.actorId, decision, depth);
        case 'reversal':
            if (!decision.targetId) return { state, events: [reactionResolved(decision, false, depth)] };
            return consumeReaction(resolveReactiveReversal(state, decision.actorId, decision.targetId), decision.actorId, decision, depth);
        case 'slashExtraBleeding':
            return resolveSlashExtraBleeding(state, decision, depth);
        case 'howDidThatMiss': {
            const spent = spendFate(state, decision.actorId, 'howDidThatMiss', { policy: 'always', incomingDamage: context.incomingDamage });
            return { state: spent.state, events: [...spent.events, reactionResolved(decision, true, depth)] };
        }
        case 'dieAnotherDay': {
            const intercepted = tryInterceptDeathWithFate(state, decision.actorId, 'always');
            return { state: intercepted.state, events: [...intercepted.events, reactionResolved(decision, !!intercepted.intercepted, depth)] };
        }
        case 'fortuneReroll': {
            const test = context.testRoll;
            const spent = spendFortune(state, decision.actorId, 'reroll', { policy: 'always', rollResult: test?.rollResult, targetNumber: test?.targetNumber }, rng);
            return { state: spent.state, events: [...spent.events, reactionResolved(decision, true, depth)] };
        }
        case 'fortunePlusOneSl': {
            const spent = spendFortune(state, decision.actorId, 'plusOneSl', { policy: 'always' }, rng);
            return { state: spent.state, events: [...spent.events, reactionResolved(decision, true, depth)] };
        }
    }
}

export function reactionOfferEvent(decision: ReactionDecision, initiativeIndex?: number): CombatEvent {
    return {
        type: 'ReactionOffered',
        i18nKey: 'combat.reaction.offered',
        data: {
            trigger: decision.trigger,
            actorId: decision.actorId,
            targetId: decision.targetId,
            reaction: decision.reaction,
            initiativeIndex,
        },
    };
}

export function reactionStrikeKey(chargerId: string, defenderId: string): string {
    return `${chargerId}->${defenderId}`;
}

function resolveRiposteDamage(state: CombatState, actorId: string, targetId: string | undefined, rng: Rng): CombatEngineResult {
    if (!targetId) return { state, events: [] };
    const actor = state.combatants[actorId];
    const weapon = equippedWeapons(actor, state).find(candidate => hasQuality(candidate, 'fast')) ?? equippedWeapons(actor, state)[0];
    const weaponDamage = damageValue(weapon?.damage ?? '+SB+3', actor);
    return resolveDamage(state, {
        attackerId: actorId,
        defenderId: targetId,
        skillId: 'melee_basic',
        slDifference: 0,
        weaponDamage,
        hitLocation: 'Body',
        disableMinimumWound: false,
        fatePolicy: 'stub',
    }, rng);
}

function resolveReactionStrike(state: CombatState, decision: ReactionDecision, rng: Rng): CombatEngineResult {
    if (!decision.targetId) return { state, events: [] };
    const actor = state.combatants[decision.actorId];
    const roll = decision.rollResult ?? Math.floor(rng.next() * 100) + 1;
    const target = decision.targetNumber ?? characteristic(actor, 'i');
    const sl = Math.round(calculateSuccessLevel(roll, target));
    const key = reactionStrikeKey(decision.targetId, actor.id);
    const flagged = {
        ...state,
        turnFlags: {
            ...state.turnFlags,
            reactionStrikeChargerPairs: [...new Set([...state.turnFlags.reactionStrikeChargerPairs, key])],
        },
    };
    const events: CombatEvent[] = [talentEvent(actor.id, 'reaction-strike', sl >= 0 ? 'initiativePassed' : 'initiativeFailed', { targetId: decision.targetId, amount: sl, primaryRoll: roll })];
    if (sl < 0) return { state: flagged, events };
    const weapon = equippedWeapons(actor, flagged)[0];
    const damage = resolveDamage(flagged, {
        attackerId: actor.id,
        defenderId: decision.targetId,
        skillId: 'melee_basic',
        slDifference: Math.max(0, sl),
        weaponDamage: damageValue(weapon?.damage ?? '+SB+3', actor),
        hitLocation: 'Body',
        fatePolicy: 'stub',
    }, rng);
    return { state: damage.state, events: [...events, ...damage.events] };
}

function resolveStepAside(state: CombatState, actorId: string): CombatEngineResult {
    const actor = state.combatants[actorId];
    const engaged = actor.engagementIds.map(id => state.combatants[id]).filter(Boolean);
    const direction = engaged.length === 0 || actor.position <= average(engaged.map(enemy => enemy.position)) ? -1 : 1;
    const disengagedFromIds = [...actor.engagementIds];
    const moved = {
        ...actor,
        position: actor.position + direction * 2,
        engagementIds: [],
    };
    const others = disengagedFromIds.map(id => {
        const other = state.combatants[id];
        return other ? { ...other, engagementIds: other.engagementIds.filter(engagedId => engagedId !== actor.id) } : undefined;
    }).filter((other): other is Combatant => !!other);
    const withCombatants = {
        ...state,
        combatants: {
            ...state.combatants,
            [actor.id]: moved,
            ...Object.fromEntries(others.map(other => [other.id, other])),
        },
        engagements: Object.fromEntries(Object.entries(state.engagements).filter(([, engagement]) => engagement.aId !== actor.id && engagement.bId !== actor.id)),
    };
    return {
        state: withCombatants,
        events: [
            {
                type: 'MovedEvent',
                i18nKey: 'combat.moved',
                data: { combatantId: actor.id, combatantName: actor.name, mode: 'walk', from: actor.position, to: moved.position, distance: 2, actionSpent: false, remainingMovement: moved.movementBudget.remaining },
            } as CombatEvent,
            {
                type: 'DisengagedEvent',
                i18nKey: 'combat.engagement.disengaged',
                data: { combatantId: actor.id, combatantName: actor.name, disengagedFromIds, actionSpent: false },
            } as CombatEvent,
        ],
    };
}

function resolveReactiveReversal(state: CombatState, actorId: string, targetId: string): CombatEngineResult {
    const actor = state.combatants[actorId];
    const target = state.combatants[targetId];
    if (!actor || !target || state.advantagePools[target.side] <= 0) return { state, events: [] };
    const loss = grantAdvantage(state, target.side, -1, { reason: 'manual', sourceCombatantId: target.id });
    const gain = grantAdvantage(loss.state, actor.side, 1, { reason: 'manual', sourceCombatantId: actor.id });
    return { state: gain.state, events: [...loss.events, ...gain.events, talentEvent(actor.id, 'reversal', 'stoleAdvantage', { targetId, trigger: 'onDefend', policy: 'always' })] };
}

function resolveSlashExtraBleeding(state: CombatState, decision: ReactionDecision, depth: number): CombatEngineResult {
    if (!decision.targetId) return { state, events: [reactionResolved(decision, false, depth)] };
    const actor = state.combatants[decision.actorId];
    if (!actor || state.advantagePools[actor.side] <= 0) return { state, events: [reactionResolved(decision, false, depth)] };
    const spent = grantAdvantage(state, actor.side, -1, { reason: 'manual', sourceCombatantId: actor.id });
    const target = spent.state.combatants[decision.targetId];
    const updated = replaceCombatant(spent.state, { ...target, conditions: [...target.conditions, 'condition_bleeding'] });
    return {
        state: updated,
        events: [
            ...spent.events,
            { type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: target.id, conditionId: 'condition_bleeding', stacks: 1 } } as CombatEvent,
            reactionResolved(decision, true, depth),
        ],
    };
}

function consumeReaction(result: CombatEngineResult, actorId: string, decision: ReactionDecision, depth: number): CombatEngineResult {
    const actor = result.state.combatants[actorId];
    if (!actor) return { state: result.state, events: [...result.events, reactionResolved(decision, true, depth)] };
    return {
        state: replaceCombatant(result.state, { ...actor, budget: { ...actor.budget, reactions: Math.max(0, actor.budget.reactions - 1) } }),
        events: [...result.events, reactionResolved(decision, true, depth)],
    };
}

function reactionResolved(decision: ReactionDecision, chosen: boolean, depth: number, extra: Record<string, unknown> = {}): CombatEvent {
    return {
        type: 'ReactionResolved',
        i18nKey: 'combat.reaction.resolved',
        data: { trigger: decision.trigger, actorId: decision.actorId, targetId: decision.targetId, reaction: decision.reaction, chosen, depth, ...extra },
    } as CombatEvent;
}

function equippedWeapons(combatant: Combatant, state: CombatState) {
    return Object.entries(combatant.character.inventory.equippedWeapons || {})
        .filter(([, equipped]) => equipped)
        .map(([id]) => state.weapons.find(weapon => weapon.id === id))
        .filter((weapon): weapon is NonNullable<typeof weapon> => !!weapon);
}

function hasTalent(combatant: Combatant, talentId: string): boolean {
    return (combatant.character.talents?.[talentId] ?? 0) > 0;
}

function damageValue(formula: string, actor: Combatant): number {
    const strengthBonus = Math.floor(characteristic(actor, 's') / 10);
    const numbers = formula.match(/[+-]?\d+/g)?.map(Number) ?? [];
    return Math.max(1, strengthBonus + numbers.reduce((sum, value) => sum + value, 0));
}

function characteristic(actor: Combatant, key: 'i' | 's'): number {
    const characteristic = actor.character.characteristics[key];
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}

function average(values: number[]): number {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function replaceCombatant(state: CombatState, combatant: Combatant): CombatState {
    return { ...state, combatants: { ...state.combatants, [combatant.id]: combatant } };
}

function talentEvent(combatantId: string, talentId: string, effect: string, data: Record<string, unknown> = {}): CombatEvent {
    return {
        type: 'TalentEffectApplied',
        i18nKey: `combat.talent.${talentId}.${effect}`,
        data: { combatantId, talentId, effect, ...data },
    } as CombatEvent;
}
