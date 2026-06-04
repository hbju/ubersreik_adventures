import type { Weapon } from '../types/wfrp.types';
import { applyConditionRemovalTest } from '../utils/conditions';
import { calculateSuccessLevel, rolld100 } from '../utils/mechanics';
import { calculateCharacteristicBonus } from '../utils/skills';
import { grantAdvantage } from './advantage';
import { mathRandomRng, type Rng } from './rng';
import {
    engagementKey,
    getWalkRun,
    isEngagedWith,
} from './spatial';
import { resolveDualWieldAttack } from './dual-wield';
import { applyReloadInterruptGuard } from './reload-interrupts';
import { resolveTalentCombatAction } from './talent-actions';
import { hasCombatTalent } from './talents';
import type {
    CombatActionDefinition,
    CombatActionKind,
    CombatActionRequest,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    Combatant,
} from './types';

export const COMBAT_ACTION_DEFINITIONS: Record<CombatActionKind, CombatActionDefinition> = {
    attack: { kind: 'attack', cost: 'action', generatesAdvantage: true },
    move: { kind: 'move', cost: 'move', generatesAdvantage: false },
    run: { kind: 'run', cost: 'action', generatesAdvantage: false },
    charge: { kind: 'charge', cost: 'action', generatesAdvantage: true },
    aim: { kind: 'aim', cost: 'action', generatesAdvantage: false },
    reload: { kind: 'reload', cost: 'action', generatesAdvantage: false },
    assess: { kind: 'assess', cost: 'action', generatesAdvantage: false },
    defend: { kind: 'defend', cost: 'action', generatesAdvantage: false },
    sprint: { kind: 'sprint', cost: 'action', generatesAdvantage: false },
    firstAid: { kind: 'firstAid', cost: 'action', generatesAdvantage: false },
    infighting: { kind: 'infighting', cost: 'action', generatesAdvantage: false },
    disengageDodge: { kind: 'disengageDodge', cost: 'action', generatesAdvantage: false },
    grappleInitiate: { kind: 'grappleInitiate', cost: 'action', generatesAdvantage: false },
    grappleMaintain: { kind: 'grappleMaintain', cost: 'action', generatesAdvantage: false },
    grappleBreak: { kind: 'grappleBreak', cost: 'free', generatesAdvantage: false },
    attackWithBoth: { kind: 'attackWithBoth', cost: 'action', generatesAdvantage: true },
    beatBlade: { kind: 'beatBlade', cost: 'action', generatesAdvantage: false },
    disarm: { kind: 'disarm', cost: 'action', generatesAdvantage: false },
    feint: { kind: 'feint', cost: 'action', generatesAdvantage: false },
    distractOpponent: { kind: 'distractOpponent', cost: 'move', generatesAdvantage: false },
};

export const IMPROVISED_WEAPON_PROFILE = {
    id: 'weapon_improvised',
    name: 'Improvised',
    damage: '+SB+1',
    qualities: ['Undamaging', 'Unbalanced'] as string[],
    reach: 'Personal',
};

export const SECONDARY_HAND_PENALTY = -20;
export const DEFENSIVE_BONUS = 20;
export const AVERAGE_TEST_MODIFIER = 20;

const SHORT_REACH_RANK = 3;

export function resolveCombatAction(
    state: CombatState,
    request: CombatActionRequest,
    rng: Rng = mathRandomRng
): CombatEngineResult {
    const result = (() => {
    switch (request.kind) {
        case 'assess':
            return resolveAssess(state, request, rng);
        case 'defend':
            return resolveDefend(state, request);
        case 'sprint':
            return resolveSprint(state, request, rng);
        case 'firstAid':
            return resolveFirstAid(state, request, rng);
        case 'aim':
            return resolveAim(state, request);
        case 'infighting':
            return resolveInfighting(state, request, rng);
        case 'disengageDodge':
            return resolveDisengageDodge(state, request, rng);
        case 'grappleInitiate':
            return resolveGrappleInitiate(state, request, rng);
        case 'grappleMaintain':
            return resolveGrappleMaintain(state, request, rng);
        case 'grappleBreak':
            return resolveGrappleBreak(state, request);
        case 'attackWithBoth':
            return resolveDualWieldAttack(state, request, rng);
        case 'beatBlade':
        case 'disarm':
        case 'feint':
        case 'distractOpponent':
            return resolveTalentCombatAction(state, request, rng);
        default:
            return rejectAction(state, request.kind, request.actorId, 'noAction');
    }
    })();

    return request.kind === 'reload' ? result : applyReloadInterruptGuard(result);
}

export function clearDefensiveBonusAtTurnStart(state: CombatState, combatantId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    const clearedPenalty = combatant.dualWieldDefensivePenalty
        ? replaceCombatant(state, { ...combatant, dualWieldDefensivePenalty: false })
        : state;
    const updatedCombatant = getCombatant(clearedPenalty, combatantId);
    if (!updatedCombatant.defensiveBonus || updatedCombatant.defensiveBonus.activeUntilRound > state.round) {
        return clearedPenalty;
    }
    return replaceCombatant(clearedPenalty, { ...updatedCombatant, defensiveBonus: undefined });
}

export function defensiveBonusForSkill(combatant: Combatant, skillId: string, round: number): number {
    const bonus = combatant.defensiveBonus;
    if (!bonus) return 0;
    if (bonus.activeUntilRound <= round) return 0;
    if (bonus.skillId.toLowerCase() !== skillId.toLowerCase()) return 0;
    return bonus.bonus;
}

export function isInfightingEngagement(state: CombatState, aId: string, bId: string): boolean {
    const key = engagementKey(aId, bId);
    return !!state.engagements[key]?.infightingMode;
}

export function isGrapplingEngagement(state: CombatState, aId: string, bId: string): boolean {
    const key = engagementKey(aId, bId);
    return !!state.engagements[key]?.grappling;
}

export function resolveEffectiveWeapon(
    combatant: Combatant,
    state: CombatState,
    opponentId?: string,
    hand: 'primary' | 'secondary' = 'primary'
): Weapon | undefined {
    const weaponById = new Map(state.weapons.map(weapon => [weapon.id, weapon]));
    const loadout = combatant.weaponLoadout;
    const weaponId = hand === 'secondary'
        ? loadout?.secondaryWeaponId ?? findEquippedWeaponId(combatant, 'secondary')
        : loadout?.primaryWeaponId ?? findEquippedWeaponId(combatant, 'primary');

    const base = weaponId ? weaponById.get(weaponId) : findFallbackWeapon(combatant, state.weapons);
    if (!base || !opponentId) return base;

    if (isInfightingEngagement(state, combatant.id, opponentId) && reachRank(base.reach) > SHORT_REACH_RANK) {
        return {
            ...base,
            ...IMPROVISED_WEAPON_PROFILE,
            id: `${base.id}:improvised`,
            name: `${base.name} (Improvised)`,
        };
    }

    return base;
}

export function grappleOutsiderToHitModifier(state: CombatState, attacker: Combatant, defender: Combatant): number {
    if (isGrappleParticipant(state, attacker.id, defender.id)) return 0;

    for (const engagedId of defender.engagementIds) {
        const key = engagementKey(defender.id, engagedId);
        const engagement = state.engagements[key];
        if (!engagement?.grappling) continue;

        if (defender.conditions.includes('condition_entangled')) return 20;
        return 10;
    }

    return 0;
}

export function canBreakGrappleByPoolComparison(state: CombatState, actorId: string, targetId: string): boolean {
    const actor = getCombatant(state, actorId);
    const target = getCombatant(state, targetId);
    return state.advantagePools[actor.side] > state.advantagePools[target.side];
}

function resolveAssess(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (actor.budget.actions <= 0) return rejectAction(state, 'assess', request.actorId, 'noAction');

    const skillId = request.skillId ?? 'observe';
    const targetNumber = request.targetNumber ?? skillTarget(actor, skillId);
    const rollResult = request.rollResult ?? rolld100(rng);
    const successLevel = Math.round(calculateSuccessLevel(rollResult, targetNumber));
    const spent = spendAction(state, actor.id);
    const events: CombatEvent[] = [];
    let currentState = spent;

    if (successLevel >= 0) {
        const amount = successLevel >= 6 ? 3 : 2;
        const granted = grantAdvantage(currentState, actor.side, amount, {
            reason: 'spendActionWin',
            sourceCombatantId: actor.id,
        });
        currentState = granted.state;
        events.push(...granted.events);
        events.push(actionResolved('assess', actor.id, 'success', COMBAT_ACTION_DEFINITIONS.assess.generatesAdvantage, { advantageGranted: amount }));
    } else {
        events.push(actionResolved('assess', actor.id, 'failure', COMBAT_ACTION_DEFINITIONS.assess.generatesAdvantage));
    }

    return { state: currentState, events };
}

function resolveDefend(state: CombatState, request: CombatActionRequest): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (actor.budget.actions <= 0) return rejectAction(state, 'defend', request.actorId, 'noAction');
    if (!request.skillId) return rejectAction(state, 'defend', request.actorId, 'missingSkill');

    const afterSpend = spendAction(state, actor.id);
    const spentActor = getCombatant(afterSpend, actor.id);
    const updated = replaceCombatant(afterSpend, {
        ...spentActor,
        defensiveBonus: {
            skillId: request.skillId,
            bonus: DEFENSIVE_BONUS,
            activeUntilRound: state.round + 1,
        },
    });

    return {
        state: updated,
        events: [actionResolved('defend', actor.id, 'applied', false)],
    };
}

function resolveAim(state: CombatState, request: CombatActionRequest): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (actor.budget.actions <= 0) return rejectAction(state, 'aim', request.actorId, 'noAction');
    const afterSpend = spendAction(state, actor.id);
    const spentActor = getCombatant(afterSpend, actor.id);
    return {
        state: replaceCombatant(afterSpend, { ...spentActor, aimedRangedAttack: true }),
        events: [actionResolved('aim', actor.id, 'applied', false)],
    };
}

function resolveSprint(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (actor.budget.actions <= 0) return rejectAction(state, 'sprint', request.actorId, 'noAction');

    const targetNumber = (request.targetNumber ?? skillTarget(actor, 'athletics')) + AVERAGE_TEST_MODIFIER;
    const rollResult = request.rollResult ?? rolld100(rng);
    const successLevel = Math.round(calculateSuccessLevel(rollResult, targetNumber));
    if (successLevel < 0) {
        return {
            state: spendAction(state, actor.id),
            events: [actionResolved('sprint', actor.id, 'failure', false)],
        };
    }

    const allowance = getWalkRun(actor);
    const distance = allowance.walk + allowance.run + successLevel;
    const direction = typeof request.moveTarget === 'number'
        ? request.moveTarget
        : typeof request.moveTarget === 'object' && 'position' in request.moveTarget
            ? request.moveTarget.position
            : actor.position + distance;

    const moved = applyForcedMove(spendAction(state, actor.id), actor.id, direction, distance, true);
    moved.events.unshift(actionResolved('sprint', actor.id, 'success', false, { distanceMoved: distance }));
    return moved;
}

function resolveFirstAid(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (actor.budget.actions <= 0) return rejectAction(state, 'firstAid', request.actorId, 'noAction');
    if (!actor.character.skills.some(skill => skill.id === 'heal' || skill.name.toLowerCase() === 'heal')) {
        return rejectAction(state, 'firstAid', request.actorId, 'missingSkill');
    }

    const targetId = request.targetId ?? actor.id;
    const target = getCombatant(state, targetId);
    if (!target.conditions.includes('condition_bleeding')) {
        return {
            state: spendAction(state, actor.id),
            events: [actionResolved('firstAid', targetId, 'failure', false)],
        };
    }

    const targetNumber = (request.targetNumber ?? skillTarget(actor, 'heal')) + AVERAGE_TEST_MODIFIER;
    const rollResult = request.rollResult ?? rolld100(rng);
    const successLevel = Math.round(calculateSuccessLevel(rollResult, targetNumber));
    let currentState = spendAction(state, actor.id);
    const events: CombatEvent[] = [];

    if (successLevel >= 0) {
        const removal = applyConditionRemovalTest(target, 'condition_bleeding', { successLevel });
        currentState = replaceCombatant(currentState, removal.combatant as Combatant);
        if (removal.events.length > 0) {
            events.push({
                type: 'ConditionApplied',
                i18nKey: 'combat.condition.effect.removed',
                data: { targetId, conditionId: 'condition_bleeding', stacks: 1 + Math.max(0, Math.floor(successLevel)) },
            });
        }
        events.push(actionResolved('firstAid', targetId, 'success', false));
    } else {
        events.push(actionResolved('firstAid', targetId, 'failure', false));
    }

    return { state: currentState, events };
}

function resolveInfighting(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (!request.targetId) return rejectAction(state, 'infighting', request.actorId, 'missingTarget');
    if (actor.budget.actions <= 0) return rejectAction(state, 'infighting', request.actorId, 'noAction');
    if (!isEngagedWith(state, actor.id, request.targetId)) return rejectAction(state, 'infighting', request.actorId, 'notEngaged');

    const opponent = getCombatant(state, request.targetId);
    const actorTarget = request.targetNumber ?? skillTarget(actor, request.skillId ?? 'melee_basic');
    const opponentTarget = request.opponentTargetNumber ?? skillTarget(opponent, request.opponentSkillId ?? 'melee_basic');
    const actorRoll = request.rollResult ?? rolld100(rng);
    const opponentRoll = request.opponentRollResult ?? rolld100(rng);
    const actorSl = Math.round(calculateSuccessLevel(actorRoll, actorTarget));
    const opponentSl = Math.round(calculateSuccessLevel(opponentRoll, opponentTarget));
    const actorWins = actorSl > opponentSl || (actorSl === opponentSl && actorTarget > opponentTarget);
    const winnerMode = request.infightingMode ?? 'infighting';
    const mode = actorWins ? winnerMode : 'normal';

    const key = engagementKey(actor.id, opponent.id);
    const currentState = replaceEngagement(spendAction(state, actor.id), key, {
        ...state.engagements[key],
        aId: actor.id,
        bId: opponent.id,
        lastAttackRound: state.round,
        infightingMode: mode === 'infighting',
    });

    return {
        state: currentState,
        events: [actionResolved('infighting', actor.id, 'success', false, {
            targetId: opponent.id,
            infightingMode: mode === 'infighting',
        })],
    };
}

function resolveDisengageDodge(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (actor.budget.actions <= 0) return rejectAction(state, 'disengageDodge', request.actorId, 'noAction');
    if (actor.engagementIds.length === 0) return rejectAction(state, 'disengageDodge', request.actorId, 'notEngaged');

    const engagedOpponents = actor.engagementIds.map(id => getCombatant(state, id));
    const actorTarget = request.targetNumber ?? skillTarget(actor, 'dodge');
    const actorRoll = request.rollResult ?? rolld100(rng);
    const actorSl = Math.round(calculateSuccessLevel(actorRoll, actorTarget));

    let bestOpponentSl = Number.NEGATIVE_INFINITY;
    let bestOpponentTarget = 0;
    for (const opponent of engagedOpponents) {
        const opponentTarget = request.opponentTargetNumber ?? skillTarget(opponent, 'melee_basic');
        const opponentRoll = request.opponentRollResult ?? rolld100(rng);
        const opponentSl = Math.round(calculateSuccessLevel(opponentRoll, opponentTarget));
        if (opponentSl > bestOpponentSl || (opponentSl === bestOpponentSl && opponentTarget > bestOpponentTarget)) {
            bestOpponentSl = opponentSl;
            bestOpponentTarget = opponentTarget;
        }
    }

    let currentState = spendAction(state, actor.id);
    const events: CombatEvent[] = [];
    const success = actorSl > bestOpponentSl || (actorSl === bestOpponentSl && actorTarget > bestOpponentTarget);

    if (success) {
        const advantage = grantAdvantage(currentState, actor.side, 1, {
            reason: 'spendActionWin',
            sourceCombatantId: actor.id,
        });
        currentState = advantage.state;
        events.push(...advantage.events);

        const destination = typeof request.moveTarget === 'number'
            ? request.moveTarget
            : typeof request.moveTarget === 'object' && 'position' in request.moveTarget
                ? request.moveTarget.position
                : actor.position + 10;
        const moved = applyForcedMove(clearEngagements(currentState, actor.id), actor.id, destination, Math.abs(destination - actor.position), false);
        currentState = moved.state;
        events.push(...moved.events);
        events.push(actionResolved('disengageDodge', actor.id, 'success', false, { advantageGranted: 1 }));
        return { state: currentState, events };
    }

    for (const opponent of engagedOpponents) {
        const granted = grantAdvantage(currentState, opponent.side, 1, {
            reason: 'spendActionLoss',
            sourceCombatantId: actor.id,
        });
        currentState = granted.state;
        events.push(...granted.events);
        events.push({
            type: 'BlowToBackAttackEvent',
            i18nKey: 'combat.action.disengageDodge.blowToBack',
            data: {
                attackerId: opponent.id,
                defenderId: actor.id,
                freeAttack: true,
            },
        });
    }

    events.push(actionResolved('disengageDodge', actor.id, 'failure', false));
    return { state: currentState, events };
}

function resolveGrappleInitiate(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (!request.targetId) return rejectAction(state, 'grappleInitiate', request.actorId, 'missingTarget');
    if (actor.budget.actions <= 0) return rejectAction(state, 'grappleInitiate', request.actorId, 'noAction');

    const target = getCombatant(state, request.targetId);
    const actorTarget = request.targetNumber ?? skillTarget(actor, 'melee_brawling');
    const targetTarget = request.opponentTargetNumber ?? skillTarget(target, 'melee_brawling');
    const actorRoll = request.rollResult ?? rolld100(rng);
    const targetRoll = request.opponentRollResult ?? rolld100(rng);
    const actorSl = Math.round(calculateSuccessLevel(actorRoll, actorTarget));
    const targetSl = Math.round(calculateSuccessLevel(targetRoll, targetTarget));
    const actorWins = actorSl > targetSl || (actorSl === targetSl && actorTarget > targetTarget);

    if (!actorWins) {
        return {
            state: spendAction(state, actor.id),
            events: [actionResolved('grappleInitiate', actor.id, 'failure', false, { targetId: target.id })],
        };
    }

    const key = engagementKey(actor.id, target.id);
    let currentState = replaceEngagement(spendAction(state, actor.id), key, {
        aId: actor.id,
        bId: target.id,
        lastAttackRound: state.round,
        grappling: true,
        infightingMode: state.engagements[key]?.infightingMode,
    });
    currentState = applyCondition(currentState, target.id, 'condition_entangled');
    currentState = stampEngagement(currentState, actor.id, target.id);

    return {
        state: currentState,
        events: [
            { type: 'ConditionApplied', i18nKey: 'combat.condition.applied', data: { targetId: target.id, conditionId: 'condition_entangled', stacks: 1 } },
            actionResolved('grappleInitiate', actor.id, 'success', false, { targetId: target.id, grappling: true }),
        ],
    };
}

function resolveGrappleMaintain(state: CombatState, request: CombatActionRequest, rng: Rng): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (!request.targetId) return rejectAction(state, 'grappleMaintain', request.actorId, 'missingTarget');
    if (actor.budget.actions <= 0) return rejectAction(state, 'grappleMaintain', request.actorId, 'noAction');
    if (!isGrapplingEngagement(state, actor.id, request.targetId)) return rejectAction(state, 'grappleMaintain', request.actorId, 'notGrappling');

    const target = getCombatant(state, request.targetId);
    const actorTarget = request.targetNumber ?? characteristicTarget(actor, 's');
    const targetTarget = request.opponentTargetNumber ?? characteristicTarget(target, 's');
    const actorRoll = request.rollResult ?? rolld100(rng);
    const targetRoll = request.opponentRollResult ?? rolld100(rng);
    const actorSl = Math.round(calculateSuccessLevel(actorRoll, actorTarget));
    const targetSl = Math.round(calculateSuccessLevel(targetRoll, targetTarget));
    const actorWins = actorSl > targetSl || (actorSl === targetSl && actorTarget > targetTarget);

    let currentState = spendAction(state, actor.id);
    const events: CombatEvent[] = [actionResolved('grappleMaintain', actor.id, actorWins ? 'success' : 'failure', false, { targetId: target.id })];

    if (actorWins) {
        const sb = calculateCharacteristicBonus(actor.character.characteristics.s);
        const slDiff = Math.max(0, actorSl - Math.max(0, targetSl));
        const damageDealt = sb + slDiff;
        const targetCombatant = getCombatant(currentState, target.id);
        const woundsAfter = Math.max(0, targetCombatant.currentWounds - damageDealt);
        currentState = replaceCombatant(currentState, {
            ...targetCombatant,
            currentWounds: woundsAfter,
            character: {
                ...targetCombatant.character,
                status: {
                    ...targetCombatant.character.status,
                    wounds: { ...targetCombatant.character.status.wounds, current: woundsAfter },
                },
            },
            resources: {
                ...targetCombatant.resources,
                wounds: { ...targetCombatant.resources.wounds, current: woundsAfter },
            },
        });
        events.push({
            type: 'DamageDealt',
            i18nKey: 'combat.damage.dealt',
            data: {
                attackerId: actor.id,
                defenderId: target.id,
                defenderName: target.name,
                hitLocation: 'Body',
                rawDamage: damageDealt,
                damageDealt,
                toughnessBonus: 0,
                armourPoints: 0,
                minimumOneWoundApplied: false,
                woundsBeyondZero: Math.max(0, damageDealt - targetCombatant.currentWounds),
                woundsBefore: targetCombatant.currentWounds,
                woundsAfter,
            },
        });
    } else {
        const granted = grantAdvantage(currentState, target.side, 1, {
            reason: 'spendActionLoss',
            sourceCombatantId: actor.id,
        });
        currentState = granted.state;
        events.push(...granted.events);
    }

    return { state: currentState, events };
}

function resolveGrappleBreak(state: CombatState, request: CombatActionRequest): CombatEngineResult {
    const actor = getCombatant(state, request.actorId);
    if (!request.targetId) return rejectAction(state, 'grappleBreak', request.actorId, 'missingTarget');
    if (!isGrapplingEngagement(state, actor.id, request.targetId)) return rejectAction(state, 'grappleBreak', request.actorId, 'notGrappling');

    if (!canBreakGrappleByPoolComparison(state, actor.id, request.targetId)) {
        return {
            state,
            events: [actionResolved('grappleBreak', actor.id, 'failure', false, { targetId: request.targetId })],
        };
    }

    const currentState = clearGrapple(state, actor.id, request.targetId);
    return {
        state: currentState,
        events: [actionResolved('grappleBreak', actor.id, 'success', false, { targetId: request.targetId })],
    };
}

export function combatantSkillTarget(combatant: Combatant, skillId: string): number {
    return skillTarget(combatant, skillId);
}

function applyForcedMove(
    state: CombatState,
    combatantId: string,
    to: number,
    distance: number,
    spendActionBudget: boolean
): CombatEngineResult {
    const combatant = getCombatant(state, combatantId);
    const updated: Combatant = {
        ...combatant,
        position: to,
        movementBudget: {
            ...combatant.movementBudget,
            remaining: Math.max(0, combatant.movementBudget.remaining - distance),
        },
        budget: {
            ...combatant.budget,
            actions: spendActionBudget ? Math.max(0, combatant.budget.actions - 1) : combatant.budget.actions,
            moves: Math.max(0, combatant.budget.moves - 1),
        },
    };

    return {
        state: replaceCombatant(state, updated),
        events: [{
            type: 'MovedEvent',
            i18nKey: 'combat.movement.moved',
            data: {
                combatantId,
                combatantName: combatant.name,
                mode: 'run',
                from: combatant.position,
                to,
                distance,
                actionSpent: spendActionBudget,
                remainingMovement: updated.movementBudget.remaining,
            },
        }],
    };
}

function clearEngagements(state: CombatState, combatantId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    const others = combatant.engagementIds.map(id => {
        const other = getCombatant(state, id);
        return { ...other, engagementIds: other.engagementIds.filter(engagedId => engagedId !== combatantId) };
    });
    return replaceCombatants(state, [{ ...combatant, engagementIds: [] }, ...others]);
}

function clearGrapple(state: CombatState, aId: string, bId: string): CombatState {
    const key = engagementKey(aId, bId);
    const engagement = state.engagements[key];
    const nextEngagements = { ...state.engagements, [key]: { ...engagement, grappling: false } };
    let currentState: CombatState = { ...state, engagements: nextEngagements };
    currentState = removeCondition(currentState, bId, 'condition_entangled');
    currentState = removeCondition(currentState, aId, 'condition_entangled');
    return currentState;
}

function isGrappleParticipant(state: CombatState, aId: string, bId: string): boolean {
    return isGrapplingEngagement(state, aId, bId);
}

function spendAction(state: CombatState, combatantId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    return replaceCombatant(state, {
        ...combatant,
        budget: { ...combatant.budget, actions: Math.max(0, combatant.budget.actions - 1) },
    });
}

function applyCondition(state: CombatState, combatantId: string, conditionId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    if (combatant.conditions.includes(conditionId)) return state;
    return replaceCombatant(state, { ...combatant, conditions: [...combatant.conditions, conditionId] });
}

function removeCondition(state: CombatState, combatantId: string, conditionId: string): CombatState {
    const combatant = getCombatant(state, combatantId);
    return replaceCombatant(state, {
        ...combatant,
        conditions: combatant.conditions.filter(id => id !== conditionId),
    });
}

function stampEngagement(state: CombatState, aId: string, bId: string): CombatState {
    const a = getCombatant(state, aId);
    const b = getCombatant(state, bId);
    return replaceCombatants(state, [
        { ...a, engagementIds: [...new Set([...a.engagementIds, bId])] },
        { ...b, engagementIds: [...new Set([...b.engagementIds, aId])] },
    ]);
}

function replaceEngagement(state: CombatState, key: string, engagement: CombatState['engagements'][string]): CombatState {
    return {
        ...state,
        engagements: {
            ...state.engagements,
            [key]: engagement,
        },
    };
}

function skillTarget(combatant: Combatant, skillId: string): number {
    const skill = combatant.character.skills.find(candidate => candidate.id === skillId || candidate.name.toLowerCase() === skillId.toLowerCase());
    if (skill) {
        const characteristic = combatant.character.characteristics[skill.characteristic as keyof typeof combatant.character.characteristics];
        const charValue = characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
        return charValue + skill.advances + skill.talents;
    }
    return characteristicTarget(combatant, 'ag');
}

function characteristicTarget(combatant: Combatant, key: 's' | 'ag' | 't'): number {
    const characteristic = combatant.character.characteristics[key];
    return characteristic.initial + characteristic.advances + characteristic.talents + characteristic.modifier;
}

function reachRank(reach: string | undefined): number {
    const normalized = (reach || 'Personal').trim().toLowerCase();
    const ranks: Record<string, number> = {
        'n/a': 0,
        personal: 1,
        'very short': 2,
        short: 3,
        average: 4,
        long: 5,
        'very long': 6,
        varies: 4,
    };
    return ranks[normalized] ?? 1;
}

function findEquippedWeaponId(combatant: Combatant, hand: 'primary' | 'secondary'): string | undefined {
    const equipped = Object.entries(combatant.character.inventory.equippedWeapons || {}).filter(([, active]) => active).map(([id]) => id);
    if (hand === 'primary') return equipped[0];
    return equipped[1];
}

function findFallbackWeapon(combatant: Combatant, weapons: Weapon[]): Weapon | undefined {
    const weaponById = new Map(weapons.map(weapon => [weapon.id, weapon]));
    const firstOwned = Object.entries(combatant.character.inventory.weapons || {}).find(([, count]) => count > 0)?.[0];
    return firstOwned ? weaponById.get(firstOwned) : undefined;
}

function reverseD100(roll: number): number {
    if (roll === 100) return 1;
    const tens = Math.floor(roll / 10);
    const ones = roll % 10;
    return ones * 10 + tens;
}

function rejectAction(state: CombatState, kind: CombatActionKind, actorId: string, reason: 'noAction' | 'noMove' | 'missingTarget' | 'missingSkill' | 'notEngaged' | 'notGrappling' | 'invalidLoadout'): CombatEngineResult {
    return {
        state,
        events: [{
            type: 'CombatActionRejected',
            i18nKey: `combat.action.rejected.${reason}`,
            data: { kind, actorId, reason },
        }],
    };
}

function actionResolved(
    kind: CombatActionKind,
    actorId: string,
    outcome: 'success' | 'failure' | 'applied' | 'partial',
    generatesAdvantage: boolean,
    extra: Record<string, unknown> = {}
): CombatEvent {
    return {
        type: 'CombatActionResolved',
        i18nKey: `combat.action.${kind}.${outcome}`,
        data: {
            kind,
            actorId,
            outcome,
            generatesAdvantage,
            ...extra,
        },
    };
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

function replaceCombatants(state: CombatState, combatants: Combatant[]): CombatState {
    return {
        ...state,
        combatants: {
            ...state.combatants,
            ...Object.fromEntries(combatants.map(combatant => [combatant.id, combatant])),
        },
    };
}
