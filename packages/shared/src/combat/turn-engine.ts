import { applyEndOfRoundConditionEffects, combatantCapabilities, resolveConditionPendingTest } from '../utils/conditions';
import { calculateCharacteristicValue, skillTarget } from '../utils/skills';
import { consumeAdditionalEffortBuff, reallocateEndOfRound, resetAdditionalEffortBuff, seedInitialAdvantage, spendAdvantage, type InitialAdvantageConfig } from './advantage';
import { isGrapplingEngagement, resolveCombatAction, resolveEffectiveWeapon } from './actions';
import { decayEngagementsEndOfRound, determineSurprise, rangeBandForDistance, rangedWeaponRange, resolveMeleeAttack, resolveRangedAttack, resolveRangedIntoMeleeAttack, resolveReloadAction } from './engine';
import { applyMove, REACH_ENGAGEMENT_DISTANCE, WeaponReach, type MoveTarget } from './spatial';
import { resolveWeaponUse } from './proficiency';
import {
    canEnterFrenzy,
    enterFrenzy,
    expirePsychologyBonuses,
    exitFrenzy,
    isFrenzied,
    markFrenzyFreeMeleeUsed,
    resolveCoolTest,
    resolveFrenzyExits,
    resolveIntimidateAction,
    resolveLeadershipAction,
    resolvePsychologyExposures,
    resolvePsychologyRoundStart,
    isActivelyAfraidOf,
    resolveEndOfRoundBrokenRally,
    resolveEndOfTurnBrokenRally,
    resolveFleeFromFieldCheck,
} from './psychology';
import { hasQuality, qualityRating } from './qualities';
import { eligibleReactions, reactionOfferEvent, resolveReactionDecision, type ReactionDecision } from './reactions';
import { spendFate, spendFortune } from './resources';
import { createSeededRng, mathRandomRng, type Rng } from './rng';
import { resolveShieldsmanActivation, toggleReversal } from './talent-actions';
import type {
    CombatActionKind,
    CombatActionRequest,
    Combatant,
    CombatEngineResult,
    CombatEvent,
    CombatState,
    DecisionLogEntry,
    MeleeAttackAction,
    MovementMode,
    OpposedRollInput,
    RangedAttackAction,
    ReloadAction,
    SideId,
} from './types';
import { accumulatedCriticalDeathCheck } from './critical';
import type { Weapon } from '../types/wfrp.types';
import { calculateSuccessLevel, rolld100 } from '../utils/mechanics';

export type TurnEnginePhase = 'setup' | 'roundStart' | 'awaitingDecision' | 'roundEnd' | 'complete';
export type CombatDecisionKind =
    | 'frenzyEnter'
    | 'frenzyExit'
    | 'intimidate'
    | 'leadership'
    | 'meleeAttack'
    | 'rangedAttack'
    | 'reload'
    | 'move'
    | 'spendAdvantage'
    | 'assess'
    | 'defend'
    | 'aim'
    | 'sprint'
    | 'firstAid'
    | 'infighting'
    | 'disengageDodge'
    | 'grappleInitiate'
    | 'grappleMaintain'
    | 'grappleBreak'
    | 'attackWithBoth'
    | 'beatBlade'
    | 'disarm'
    | 'feint'
    | 'distractOpponent'
    | 'shieldsman'
    | 'reversal'
    | 'reaction'
    | 'endTurn'
    | 'wait'
    | 'fortuneReroll';

export interface CombatDecision {
    kind: CombatDecisionKind;
    actorId: string;
    reason?: string;
    action?: MeleeAttackAction | RangedAttackAction | ReloadAction;
    request?: CombatActionRequest;
    target?: MoveTarget;
    destination?: MoveTarget;
    mode?: MovementMode;
    advantageAction?: 'additionalAction' | 'fleeFromHarm' | 'additionalEffort' | 'batter' | 'trick' | 'furiousAssault';
    targetId?: string;
    weaponId?: string;
    secondaryTargetId?: string;
    infightingMode?: 'normal' | 'infighting';
    shieldsmanMode?: 'damage' | 'push';
    reversalActive?: boolean;
    qualityActivation?: { qualityId: string; effect: string; cost: number };
    reaction?: ReactionDecision['reaction'];
    trigger?: ReactionDecision['trigger'];
    rollResult?: number;
    targetNumber?: number;
    defenceSkill?: string;
    decisionLog?: DecisionLogEntry;
    parameterDomains?: Record<string, unknown>;
}

export interface LegalDecision extends CombatDecision {
    reason?: string;
    targetIds?: string[];
    weaponIds?: string[];
}

export interface DecisionContext {
    level: 'turn' | 'resolution';
    reason?: string;
    engine: TurnEngineState;
    state: CombatState;
    actor: Combatant;
    legalDecisions: LegalDecision[];
    options?: CombatDecision[];
    parentDecision?: CombatDecision;
    rng: Rng;
}

export interface CombatantController {
    choose(context: DecisionContext): CombatDecision | undefined;
}

export type ControllerResolver = (actorId: string) => CombatantController | undefined;

function toResolver(c?: CombatantController | Record<string, CombatantController> | ControllerResolver): ControllerResolver {
    if (!c) return () => undefined;
    if (typeof c === 'function') return c;
    if (isController(c)) return () => c;
    return id => (c as Record<string, CombatantController>)[id];
}

export interface TurnEngineOptions {
    seed?: number | string;
    maxRounds?: number;
    surprisedIds?: string[];
    unsurprisedIds?: string[];
    surprisedSide?: SideId;
    initialAdvantage?: Omit<InitialAdvantageConfig, 'state' | 'outnumbering'>;
}

export interface TurnEngineState {
    state: CombatState;
    phase: TurnEnginePhase;
    round: number;
    activeCombatantId?: string;
    initiativeOrder: string[];
    turnIndex: number;
    maxRounds: number;
    outcome?: 'ally' | 'adversary' | 'draw';
    terminalReason?: 'sideDown' | 'maxRounds';
    rng: Rng;
    seed?: number | string;
    events: CombatEvent[];
}

export interface TurnEngineStep {
    kind: 'automatic' | 'decision';
    engine: TurnEngineState;
    events: CombatEvent[];
    decision?: CombatDecision;
}

export type TurnEngineObserver = (step: TurnEngineStep) => void;

export class ScriptedController implements CombatantController {
    private index = 0;

    constructor(private readonly decisions: Array<CombatDecision | ((context: DecisionContext) => CombatDecision | undefined)>) { }

    choose(context: DecisionContext): CombatDecision | undefined {
        const next = this.decisions[this.index++];
        return typeof next === 'function' ? next(context) : next;
    }
}

export interface ActionCatalogueEntry {
    kind: CombatDecisionKind;
    legal(state: CombatState, actor: Combatant): LegalDecision[];
    dispatch(engine: TurnEngineState, decision: CombatDecision, resolve?: ControllerResolver): CombatEngineResult;
}

export function createTurnEngine(state: CombatState, options: TurnEngineOptions = {}): TurnEngineState {
    const rng = options.seed === undefined ? mathRandomRng : createSeededRng(options.seed);
    return {
        state,
        phase: 'setup',
        round: state.round,
        initiativeOrder: [],
        turnIndex: 0,
        maxRounds: options.maxRounds ?? 50,
        rng,
        seed: options.seed,
        events: [],
    };
}

export function cloneTurnEngine(engine: TurnEngineState): TurnEngineState {
    return {
        ...engine,
        state: structuredCloneSafe(engine.state),
        events: [...engine.events],
        initiativeOrder: [...engine.initiativeOrder],
        rng: engine.rng.clone?.() ?? engine.rng,
    };
}

export function advanceToNextDecision(engine: TurnEngineState, options: TurnEngineOptions = {}, resolver?: ControllerResolver): TurnEngineState {
    let current: TurnEngineState = engine;
    while (current.phase !== 'awaitingDecision' && current.phase !== 'complete') {
        current = stepAutomatic(current, options, resolver);
    }
    return current;
}

export function applyDecision(
    engine: TurnEngineState,
    decision: CombatDecision,
    controllers?: CombatantController | Record<string, CombatantController> | ControllerResolver
): TurnEngineState {
    if (engine.phase !== 'awaitingDecision' || !engine.activeCombatantId) return engine;
    const frenzyExit = resolveFrenzyExits(engine.state);
    const exposure = resolvePsychologyExposures(frenzyExit.state, engine.rng);
    const currentEngine = {
        ...engine,
        state: exposure.state,
        events: [...engine.events, ...frenzyExit.events],
    };
    if (decision.actorId !== currentEngine.activeCombatantId) {
        return withEvents(currentEngine, [
            ...exposure.events,
            turnEvent('TurnDecisionRejected', 'combat.turn.rejected.wrongActor', { actorId: decision.actorId, activeCombatantId: currentEngine.activeCombatantId, reason: 'wrongActor' }),
        ]);
    }

    const actor = currentEngine.state.combatants[decision.actorId];
    const legal = legalDecisions(currentEngine.state, actor);
    if (!legal.some(candidate => matchesLegalDecision(candidate, decision))) {
        return withEvents(currentEngine, [
            ...exposure.events,
            turnEvent('TurnDecisionRejected', 'combat.turn.rejected.illegal', { actorId: decision.actorId, reason: 'illegal', decision: decision.kind }),
        ]);
    }

    const entry = ACTION_CATALOGUE.find(candidate => candidate.kind === decision.kind);
    if (!entry) return rejectDecision(currentEngine, decision, 'missingHandler');
    const resolve = toResolver(controllers);
    let result = entry.dispatch(currentEngine, decision, resolve);
    result = threadDeferredResolutionDecisions(currentEngine, decision, result, resolve);
    result = threadDamageInterceptions({ ...currentEngine, state: result.state }, decision, result, resolve);
    result = threadDeathInterceptions({ ...currentEngine, state: result.state }, decision, result, resolve);
    const reconciled = resolveFrenzyExits(result.state);
    result = {
        state: reconciled.state,
        events: [...result.events, ...reconciled.events],
    };
    result = appendDecisionLog(result, decision, 'turn');
    result = { ...result, events: [...exposure.events, ...result.events] };

    const next = {
        ...currentEngine,
        state: result.state,
        events: [...currentEngine.events, ...result.events],
    };
    return shouldEndTurn(next, decision.actorId, decision.kind)
        ? finishTurn(next)
        : { ...next, phase: 'awaitingDecision' };
}

export function runCombatToCompletion(
    state: CombatState,
    controllers: Record<string, CombatantController> | CombatantController | ControllerResolver,
    options: TurnEngineOptions = {},
    observer?: TurnEngineObserver
): TurnEngineState {
    let engine = createTurnEngine(state, options);
    let guard = 0;
    const maxRounds = options.maxRounds ?? 50;
    while (engine.phase !== 'complete' && guard++ < maxRounds * Math.max(1, Object.keys(state.combatants).length)) {
        const automaticEventCount = engine.events.length;
        engine = advanceToNextDecision(engine, options);
        const automaticEvents = engine.events.slice(automaticEventCount);
        if (automaticEvents.length > 0) {
            observer?.({ kind: 'automatic', engine, events: automaticEvents });
        }
        if (engine.phase === 'complete' || !engine.activeCombatantId) break;
        const actor = engine.state.combatants[engine.activeCombatantId];
        const resolve = toResolver(controllers);
        const controller = resolve(actor.id);
        const decision = controller?.choose({
            level: 'turn',
            engine,
            state: engine.state,
            actor,
            legalDecisions: legalDecisions(engine.state, actor),
            rng: engine.rng,
        }) ?? { kind: 'endTurn', actorId: actor.id };
        const decisionEventCount = engine.events.length;
        engine = applyDecision(engine, decision, controllers);
        observer?.({
            kind: 'decision',
            engine,
            events: engine.events.slice(decisionEventCount),
            decision,
        });
    }
    if (engine.phase === 'complete') return engine;
    const completed = complete(engine, 'draw', 'maxRounds');
    observer?.({
        kind: 'automatic',
        engine: completed,
        events: completed.events.slice(engine.events.length),
    });
    return completed;
}

export function legalDecisions(state: CombatState, combatant: Combatant): LegalDecision[] {
    if (!isActive(combatant)) return [{ kind: 'wait', actorId: combatant.id, reason: 'incapacitated' }];
    const legal = ACTION_CATALOGUE.flatMap(entry => entry.legal(state, combatant));
    return isFrenzied(combatant) ? frenzyLegalDecisions(state, combatant, legal) : legal;
}

export const ACTION_CATALOGUE: ActionCatalogueEntry[] = [
    {
        kind: 'endTurn',
        legal: (_state, actor) => [{ kind: 'endTurn', actorId: actor.id }],
        dispatch: engine => ({ state: engine.state, events: [] }),
    },
    {
        kind: 'wait',
        legal: (_state, actor) => [{ kind: 'wait', actorId: actor.id }],
        dispatch: engine => ({ state: engine.state, events: [] }),
    },
    {
        kind: 'frenzyEnter',
        legal: (state, actor) => canEnterFrenzy(actor)
            && !isFrenzied(actor)
            && actionBudgetReady(actor)
            && enemyIds(state, actor).length > 0
            ? [{ kind: 'frenzyEnter', actorId: actor.id }]
            : [],
        dispatch: (engine, decision) => {
            const actor = engine.state.combatants[decision.actorId];
            const automatic = hasTalent(actor, 'flagellant');
            const targetNumber = decision.targetNumber
                ?? calculateCharacteristicValue(actor.character.characteristics.wp);
            const roll = automatic ? undefined : decision.rollResult ?? rolld100(engine.rng);
            const successLevel = roll === undefined
                ? undefined
                : Math.round(calculateSuccessLevel(roll, targetNumber));
            const success = automatic || (successLevel ?? -1) >= 0;
            let result: CombatEngineResult = { state: engine.state, events: [] };
            if (success) {
                result = enterFrenzy(engine.state, actor.id, automatic ? 'flagellant' : 'willpower');
            }
            result.events.unshift({
                type: 'FrenzyTestResolved',
                i18nKey: success
                    ? 'combat.psychology.frenzy.enter.success'
                    : 'combat.psychology.frenzy.enter.failure',
                data: {
                    combatantId: actor.id,
                    action: 'enter',
                    roll,
                    targetNumber: automatic ? undefined : targetNumber,
                    successLevel,
                    automatic,
                    success,
                },
            });
            return spendTurnAction(result.state, actor.id, result.events);
        },
    },
    {
        kind: 'frenzyExit',
        legal: (_state, actor) => isFrenzied(actor)
            && hasTalent(actor, 'battle-rage')
            && actionBudgetReady(actor)
            ? [{ kind: 'frenzyExit', actorId: actor.id }]
            : [],
        dispatch: (engine, decision) => {
            const actor = engine.state.combatants[decision.actorId];
            const test = decision.rollResult === undefined && decision.targetNumber === undefined
                ? resolveCoolTest(actor, engine.rng)
                : {
                    roll: decision.rollResult ?? rolld100(engine.rng),
                    targetNumber: decision.targetNumber ?? calculateCharacteristicValue(actor.character.characteristics.wp),
                    successLevel: 0,
                };
            if (decision.rollResult !== undefined || decision.targetNumber !== undefined) {
                test.successLevel = Math.round(calculateSuccessLevel(test.roll, test.targetNumber));
            }
            const success = test.successLevel >= 0;
            let result = success
                ? exitFrenzy(engine.state, actor.id, 'battleRage')
                : { state: engine.state, events: [] };
            result.events.unshift({
                type: 'FrenzyTestResolved',
                i18nKey: success
                    ? 'combat.psychology.frenzy.exit.success'
                    : 'combat.psychology.frenzy.exit.failure',
                data: {
                    combatantId: actor.id,
                    action: 'exit',
                    ...test,
                    automatic: false,
                    success,
                },
            });
            return spendTurnAction(result.state, actor.id, result.events);
        },
    },
    {
        kind: 'intimidate',
        legal: (state, actor) => actionBudgetReady(actor)
            ? enemyIds(state, actor).map(targetId => ({
                kind: 'intimidate',
                actorId: actor.id,
                targetId,
                targetIds: [targetId],
                request: { kind: 'intimidate', actorId: actor.id, targetId },
            }))
            : [],
        dispatch: (engine, decision) => {
            const targetId = decision.targetId ?? decision.request?.targetId;
            if (!targetId) return { state: engine.state, events: [decisionRejected(decision, 'missingTarget')] };
            const result = resolveIntimidateAction(engine.state, decision.actorId, targetId, engine.rng, {
                rollResult: decision.rollResult ?? decision.request?.rollResult,
                targetNumber: decision.targetNumber ?? decision.request?.targetNumber,
                opponentRollResult: decision.request?.opponentRollResult,
                opponentTargetNumber: decision.request?.opponentTargetNumber,
            });
            return spendTurnAction(result.state, decision.actorId, result.events);
        },
    },
    {
        kind: 'leadership',
        legal: (state, actor) => actionBudgetReady(actor) && allyIds(state, actor).length > 0
            ? [{ kind: 'leadership', actorId: actor.id, request: { kind: 'leadership', actorId: actor.id } }]
            : [],
        dispatch: (engine, decision) => {
            const result = resolveLeadershipAction(engine.state, decision.actorId, engine.rng, {
                rollResult: decision.rollResult ?? decision.request?.rollResult,
                targetNumber: decision.targetNumber ?? decision.request?.targetNumber,
            });
            return spendTurnAction(result.state, decision.actorId, result.events);
        },
    },
    {
        kind: 'move',
        legal: (state, actor) => {
            const capabilities = combatantCapabilities(actor);
            if (actor.budget.moves <= 0 || !capabilities.canMove) return [];
            // Flee! talent: +1 M per rank while Broken (WFRP4e p.165)
            const fleeTalentRank = capabilities.mustFlee ? (actor.character.talents?.['flee'] ?? 0) : 0;
            const walk = actor.movementBudget.walk + fleeTalentRank;
            const run = actor.movementBudget.run + fleeTalentRank * 2;
            let destinations: { mode: MovementMode; target: number | { combatantId: string } }[] = [];
            for (const mode of ['walk', 'run'] as MovementMode[]) {
                const reach = mode === 'walk' ? walk : run;
                for (const i of [...Array(reach + 1).keys()].map(i => -reach + i).filter(i => i !== 0 && Math.abs(actor.position + i) <= 100)) {
                    destinations.push({ mode, target: actor.position + i });
                }
            }
            if (actor.budget.actions > 0) {
                const inRangeEnemies = enemyIds(state, actor).filter(targetId => {
                    const target = state.combatants[targetId];
                    const distance = Math.abs(target.position - actor.position);
                    return distance >= actor.movementBudget.walk / 2 && distance <= actor.movementBudget.run;
                });
                destinations = [
                    ...destinations,
                    ...inRangeEnemies.map(targetId => ({ mode: 'charge' as MovementMode, target: { combatantId: targetId } })),
                ]
            }
            return destinations.map(destination => ({
                kind: 'move',
                actorId: actor.id,
                mode: destination.mode,
                target: destination.target,
                targetId: typeof destination.target === 'object' && destination.target && 'combatantId' in destination.target ? destination.target.combatantId : undefined,
                destination: destination.target,
                parameterDomains: { modes: ['walk', 'run', 'charge'] },
            }));
        },
        dispatch: (engine, decision, resolve) => {
            const target = decision.target ?? decision.destination;
            if (target === undefined) return { state: engine.state, events: [decisionRejected(decision, 'missingTarget')] };
            let result = applyMove(engine.state, decision.actorId, target, decision.mode ?? 'walk', engine.rng);
            if (decision.mode === 'charge') {
                const action = decision.action as MeleeAttackAction | undefined;
                result = threadChargeReactions({ ...engine, state: result.state }, decision, result, resolve);
                if (!action) return result;

                const defence = withDefenceSkillChoice({ ...engine, state: result.state }, action, resolve);
                let prepared = withFateInterceptionChoice({ ...engine, state: defence.state, events: [...result.events, ...defence.events] }, resolve, action.defenderId, defence.action);
                prepared = { ...prepared, events: [...engine.events, ...prepared.events] };
                result = resolveMeleeAttack(prepared.state, prepared.action, engine.rng);
                result = { state: result.state, events: [...prepared.events, ...result.events] };
                result = threadAttackReactions({ ...engine, state: result.state }, decision, result, resolve);
                return spendTurnAction(result.state, decision.actorId, result.events);
            }
            return result;
        },
    },
    {
        kind: 'meleeAttack',
        legal: (state, actor) => {
            const actorReach = REACH_ENGAGEMENT_DISTANCE[(state.weapons.filter(weapon => weapon.id === (actor.weaponLoadout?.primaryWeaponId ?? ''))?.[0]?.reach as WeaponReach) ?? "Short"];
            return meleeBudgetReady(state, actor)
                ? enemyIds(state, actor).filter(id => Math.abs(state.combatants[id].position - actor.position) <= actorReach).map(targetId => ({ kind: 'meleeAttack', actorId: actor.id, targetId, targetIds: [targetId] }))
                : []
        },
        dispatch: (engine, decision, resolve) => {
            const action = decision.action as MeleeAttackAction | undefined;
            if (!action) return { state: engine.state, events: [decisionRejected(decision, 'missingAction')] };
            const defence = withDefenceSkillChoice(engine, action, resolve);
            const prepared = withFateInterceptionChoice({ ...engine, state: defence.state }, resolve, action.defenderId, defence.action);
            let result = resolveMeleeAttack(prepared.state, prepared.action, engine.rng);
            result = { state: result.state, events: [...defence.events, ...prepared.events, ...result.events] };
            result = threadAttackReactions({ ...engine, state: result.state }, decision, result, resolve);
            return engine.state.combatants[decision.actorId].budget.actions > 0
                ? spendTurnAction(result.state, decision.actorId, result.events)
                : consumeFrenzyFreeMelee(result.state, decision.actorId, result.events);
        },
    },
    {
        kind: 'rangedAttack',
        legal: (state, actor) => {
            if (!actionBudgetReady(actor) || !canUseRangedWeapon(state, actor) || !enemyInRange(state, actor)) return [];
            const weapon = equippedWeapon(state, actor);
            if (!weapon) return [];
            return enemyIds(state, actor).filter(targetId => isInRange(actor, state.combatants[targetId], weapon)).map(targetId => ({
                kind: 'rangedAttack',
                actorId: actor.id,
                targetId,
                targetIds: [targetId],
                weaponId: weapon?.id,
                weaponIds: weapon ? [weapon.id] : [],
            }));
        },
        dispatch: (engine, decision, resolver) => {
            const action = decision.action as RangedAttackAction | undefined;
            if (!action) return { state: engine.state, events: [decisionRejected(decision, 'missingAction')] };
            const prepared = withFateInterceptionChoice(engine, resolver, action.defenderId, action);
            const rangedAction = prepared.action as RangedAttackAction;
            const target = prepared.state.combatants[rangedAction.defenderId];
            const result = prepared.state.rules?.shootingIntoMelee && target?.engagementIds.length
                ? resolveRangedIntoMeleeAttack(prepared.state, { ...rangedAction, enabled: true }, engine.rng)
                : resolveRangedAttack(prepared.state, rangedAction, engine.rng);
            return result.events.some(event => event.type === 'RangedShotRejected')
                ? result
                : spendTurnAction(result.state, decision.actorId, [...prepared.events, ...result.events]);
        },
    },
    {
        kind: 'reload',
        legal: (state, actor) => {
            if (!actionBudgetReady(actor)) return [];
            return reloadableWeaponIds(state, actor).map(weaponId => ({
                kind: 'reload',
                actorId: actor.id,
                weaponId,
                weaponIds: [weaponId],
                action: { actorId: actor.id, weaponId } as ReloadAction,
            }));
        },
        dispatch: (engine, decision) => {
            const action = (decision.action ?? (decision.weaponId ? { actorId: decision.actorId, weaponId: decision.weaponId } : undefined)) as ReloadAction | undefined;
            if (!action) return { state: engine.state, events: [decisionRejected(decision, 'missingAction')] };
            return resolveReloadAction(engine.state, action, engine.rng);
        },
    },
    {
        kind: 'spendAdvantage',
        legal: (state, actor) => advantageSpendDecisions(state, actor),
        dispatch: (engine, decision) => {
            if (!decision.advantageAction) return { state: engine.state, events: [decisionRejected(decision, 'missingAction')] };
            if (decision.advantageAction === 'furiousAssault') return applyFuriousAssault(engine.state, decision.actorId);
            return spendAdvantage(engine.state, engine.state.combatants[decision.actorId].side, decision.advantageAction, { actorId: decision.actorId, targetId: decision.targetId }, engine.rng);
        },
    },
    ...combatActionEntries(['assess', 'defend', 'aim', 'sprint'], {
        defend: (state, actor) => ({ skillId: defensiveSkillFor(state, actor) }),
    }),
    ...allyTargetedCombatActionEntries(['firstAid'], {
        firstAid: () => ({ skillId: 'heal' }),
    }),
    ...targetedCombatActionEntries(['infighting', 'disengageDodge', 'grappleInitiate', 'grappleMaintain', 'grappleBreak', 'attackWithBoth', 'beatBlade', 'disarm', 'feint', 'distractOpponent']),
    {
        kind: 'shieldsman',
        legal: (state, actor) => hasTalent(actor, 'shieldsman') && state.advantagePools[actor.side] >= 2 && !state.turnFlags.shieldsmanUsedThisTurnIds.includes(actor.id)
            ? enemyIds(state, actor).map(targetId => ({ kind: 'shieldsman', actorId: actor.id, targetId, targetIds: [targetId], parameterDomains: { shieldsmanMode: ['push', 'damage'] } }))
            : [],
        dispatch: (engine, decision, resolver) => {
            const controller = resolver?.(decision.actorId);
            const mode = decision.shieldsmanMode ?? chooseResolution(engine, controller, decision.actorId, 'shieldsmanMode', [
                { kind: 'shieldsman', actorId: decision.actorId, targetId: decision.targetId, shieldsmanMode: 'push' },
                { kind: 'shieldsman', actorId: decision.actorId, targetId: decision.targetId, shieldsmanMode: 'damage' },
            ], decision)?.shieldsmanMode ?? 'push';
            if (!decision.targetId) return { state: engine.state, events: [decisionRejected(decision, 'missingTarget')] };
            return resolveShieldsmanActivation(engine.state, decision.actorId, decision.targetId, mode, 'always');
        },
    },
    {
        kind: 'reversal',
        legal: (_state, actor) => hasTalent(actor, 'reversal') && !actor.reversalActive
            ? [{ kind: 'reversal', actorId: actor.id, parameterDomains: { reversalActive: [true, false] } }]
            : [],
        dispatch: (engine, decision, resolver) => {
            const controller = resolver?.(decision.actorId);
            const active = decision.reversalActive ?? chooseResolution(engine, controller, decision.actorId, 'reversalToggle', [
                { kind: 'reversal', actorId: decision.actorId, reversalActive: true },
                { kind: 'reversal', actorId: decision.actorId, reversalActive: false },
            ], decision)?.reversalActive ?? true;
            return toggleReversal(engine.state, decision.actorId, active, 'always');
        },
    },
];

type CombatActionEnricher = (state: CombatState, actor: Combatant) => Partial<CombatActionRequest>;

function combatActionEntries(
    kinds: CombatActionKind[],
    enrich: Partial<Record<CombatActionKind, CombatActionEnricher>> = {}
): ActionCatalogueEntry[] {
    return kinds.map(kind => ({
        kind: kind as CombatDecisionKind,
        legal: (state, actor) => {
            if (!actionBudgetReady(actor)) return [];
            const extra = enrich[kind]?.(state, actor) ?? {};
            return [{ kind: kind as CombatDecisionKind, actorId: actor.id, request: { kind, actorId: actor.id, ...extra } }];
        },
        dispatch: (engine, decision) => resolveCombatAction(engine.state, requestForDecision(kind, decision), engine.rng),
    }));
}

function allyTargetedCombatActionEntries(
    kinds: CombatActionKind[],
    enrich: Partial<Record<CombatActionKind, CombatActionEnricher>> = {}
): ActionCatalogueEntry[] {
    return kinds.map(kind => ({
        kind: kind as CombatDecisionKind,
        legal: (state, actor) => {
            if (!combatActionBudgetReady(actor, kind)) return [];
            if (!combatActionTalentReady(actor, kind)) return [];
            if (!actor.character.skills.some(s => s.id === 'heal')) return [];
            const extra = enrich[kind]?.(state, actor) ?? {};
            return allyIds(state, actor).map(targetId => ({
                kind: kind as CombatDecisionKind,
                actorId: actor.id,
                targetId,
                targetIds: [targetId],
                request: { kind, actorId: actor.id, targetId, ...extra },
            }));
        },
        dispatch: (engine, decision, resolver) => {
            const controller = resolver?.(decision.actorId);
            const request = requestForDecision(kind, withThreadedSubDecision(engine, decision, controller));
            return resolveCombatAction(engine.state, request, engine.rng);
        },
    }));
}

/** The skill a Defend/On-Guard bonus attaches to: the equipped melee weapon's skill, else Dodge. */
function defensiveSkillFor(state: CombatState, actor: Combatant): string {
    const weapon = equippedWeapon(state, actor);
    if (weapon) {
        const use = resolveWeaponUse(actor, weapon);
        if (use.usable && use.test.type === 'skill' && use.test.skillId.startsWith('melee')) return use.test.skillId;
    }
    return 'dodge';
}

function allyIds(state: CombatState, actor: Combatant): string[] {
    return Object.values(state.combatants)
        .filter(other => other.id !== actor.id && other.side === actor.side && isActive(other))
        .map(other => other.id);
}

function targetedCombatActionEntries(kinds: CombatActionKind[]): ActionCatalogueEntry[] {
    return kinds.map(kind => ({
        kind: kind as CombatDecisionKind,
        legal: (state, actor) => {
            if (!combatActionBudgetReady(actor, kind)) return [];
            if (!combatActionTalentReady(actor, kind)) return [];
            if (kind === 'grappleBreak' || kind === 'grappleMaintain') {
                if (!actor.engagementIds.some(id => isGrapplingEngagement(state, actor.id, id))) return [];
            }

            const targets = kind === 'disengageDodge'
                ? actor.engagementIds.filter(id => isActive(state.combatants[id]))
                : enemyIds(state, actor);
            const effectiveTargets = targets.length > 0 ? targets : [undefined];
            return effectiveTargets.map(targetId => ({
                kind: kind as CombatDecisionKind,
                actorId: actor.id,
                targetId,
                targetIds: targetId ? [targetId] : [],
                request: { kind, actorId: actor.id, targetId },
            }));
        },
        dispatch: (engine, decision, resolver) => {
            const controller = resolver?.(decision.actorId);
            const request = requestForDecision(kind, withThreadedSubDecision(engine, decision, controller));
            return resolveCombatAction(engine.state, request, engine.rng);
        },
    }));
}

function matchesLegalDecision(candidate: LegalDecision, decision: CombatDecision): boolean {
    if (candidate.kind !== decision.kind) return false;
    if (candidate.advantageAction && candidate.advantageAction !== decision.advantageAction) return false;
    const requestedTargetId = decision.targetId ?? (decision.action as MeleeAttackAction | RangedAttackAction | undefined)?.defenderId ?? decision.request?.targetId;
    if (candidate.targetId && requestedTargetId && candidate.targetId !== requestedTargetId) return false;
    if (candidate.targetId && !requestedTargetId && !decision.action && !decision.request) return false;
    const requestedWeaponId = decision.weaponId ?? (decision.action as ReloadAction | undefined)?.weaponId ?? (decision.action as MeleeAttackAction | RangedAttackAction | undefined)?.attacker?.weaponId;
    if (candidate.weaponId && requestedWeaponId && candidate.weaponId !== requestedWeaponId) return false;
    return true;
}

function requestForDecision(kind: CombatActionKind, decision: CombatDecision): CombatActionRequest {
    return {
        kind,
        actorId: decision.actorId,
        targetId: decision.targetId ?? decision.request?.targetId,
        moveTarget: decision.destination ?? decision.target ?? decision.request?.moveTarget,
        secondaryTargetId: decision.secondaryTargetId ?? decision.request?.secondaryTargetId,
        infightingMode: decision.infightingMode ?? decision.request?.infightingMode,
        policy: talentPolicyFor(kind),
        ...decision.request,
    };
}

function withThreadedSubDecision(engine: TurnEngineState, decision: CombatDecision, controller?: CombatantController): CombatDecision {
    if (decision.kind === 'infighting' && !decision.infightingMode) {
        return {
            ...decision,
            infightingMode: chooseResolution(engine, controller, decision.actorId, 'infightingMode', [
                { ...decision, infightingMode: 'infighting' },
                { ...decision, infightingMode: 'normal' },
            ], decision)?.infightingMode ?? 'infighting',
        };
    }
    if (decision.kind === 'attackWithBoth' && !decision.secondaryTargetId) {
        const actor = engine.state.combatants[decision.actorId];
        const targets = enemyIds(engine.state, actor);
        const options = targets.map(targetId => ({ ...decision, secondaryTargetId: targetId }));
        return { ...decision, secondaryTargetId: chooseResolution(engine, controller, decision.actorId, 'dualWielderTarget', options, decision)?.secondaryTargetId ?? decision.targetId };
    }
    return decision;
}

function withDefenceSkillChoice(
    engine: TurnEngineState,
    action: MeleeAttackAction,
    resolver?: ControllerResolver
): { state: CombatState; action: MeleeAttackAction; events: CombatEvent[] } {
    const attacker = engine.state.combatants[action.attackerId];
    const defender = engine.state.combatants[action.defenderId];
    if (!attacker || !defender) return { state: engine.state, action, events: [] };

    const options = defenceSkillOptions(engine.state, attacker, defender);
    if (options.length === 0) return { state: engine.state, action, events: [] };

    const controller = resolver?.(defender.id);
    const explicitSkill = action.defender?.skillId;
    const explicitDefenderRoll = !!action.defender && action.defender.targetNumber > 0;
    const chosen = options.length > 1 && controller && !explicitDefenderRoll
        ? chooseResolution(engine, controller, defender.id, 'defenceSkill', options.map(skill => ({
            kind: 'meleeAttack',
            actorId: defender.id,
            targetId: attacker.id,
            defenceSkill: skill,
        })), { kind: 'meleeAttack', actorId: defender.id, targetId: attacker.id })?.defenceSkill ?? options[0]
        : explicitSkill && options.includes(explicitSkill)
            ? explicitSkill
            : options[0];

    const events: CombatEvent[] = options.length > 1 && !explicitDefenderRoll
        ? [turnEvent('ResolutionDecisionRequested', 'combat.turn.resolutionDecision', {
            actorId: defender.id,
            reason: 'defenceSkill',
            chosen,
            options,
        })]
        : [];
    return {
        state: engine.state,
        action: {
            ...action,
            defender: buildDefenderRoll(engine.state, defender, chosen, action.defender),
        },
        events,
    };
}

function defenceSkillOptions(state: CombatState, attacker: Combatant, defender: Combatant): string[] {
    const options: string[] = [];
    const weapon = equippedWeapon(state, defender);
    if (weapon) {
        const use = resolveWeaponUse(defender, weapon);
        if (use.usable && use.test.type === 'skill' && use.test.skillId.startsWith('melee')) {
            options.push(use.test.skillId);
        }
    }
    options.push('dodge');
    if (isActivelyAfraidOf(attacker, defender.id)) options.push('intimidate');
    return [...new Set(options)];
}

function buildDefenderRoll(
    state: CombatState,
    defender: Combatant,
    skillId: string,
    existing?: OpposedRollInput
): OpposedRollInput {
    const weapon = skillId.startsWith('melee') ? equippedWeapon(state, defender) : undefined;
    return {
        ...existing,
        skillId,
        targetNumber: existing?.targetNumber && existing.targetNumber > 0 ? existing.targetNumber : skillTarget(defender, skillId),
        rollResult: existing?.rollResult,
        weaponId: weapon?.id,
    };
}

function threadDeferredResolutionDecisions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, resolver?: ControllerResolver): CombatEngineResult {
    const controller = resolver?.(parent.actorId);
    if (!controller) return result;
    const deferred = result.events.filter(event => event.type === 'QualityEffectApplied' && (event as any).data?.activation?.policy === 'never');
    if (deferred.length === 0) return result;

    let state = result.state;
    const events = [...result.events];
    for (const event of deferred) {
        const data = (event as any).data ?? {};
        const activation = data.activation ?? {};
        const cost = activation.cost?.resource === 'advantage' ? Number(activation.cost.amount ?? data.amount ?? 0) : 0;
        const choice = chooseResolution({ ...engine, state }, controller, parent.actorId, 'qualityActivation', [
            { kind: 'spendAdvantage', actorId: parent.actorId, targetId: data.targetId, qualityActivation: { qualityId: data.qualityId, effect: activation.effect, cost } },
            { kind: 'wait', actorId: parent.actorId, reason: 'declineQualityActivation' },
        ], parent);
        if (choice?.kind === 'spendAdvantage') {
            const applied = applyQualityActivationChoice(state, parent.actorId, data.targetId, data.qualityId, activation.effect, cost);
            state = applied.state;
            events.push(...applied.events);
        }
        if (choice?.decisionLog) events.push(decisionLogEvent(choice, 'resolution'));
        events.push(turnEvent('ResolutionDecisionRequested', 'combat.turn.resolutionDecision', {
            actorId: parent.actorId,
            reason: 'qualityActivation',
            qualityId: data.qualityId,
            chosen: choice?.kind ?? 'none',
        }));
    }
    return { state, events };
}

function threadAttackReactions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, resolver?: ControllerResolver): CombatEngineResult {
    const attackEvent = result.events.find((event): event is Extract<CombatEvent, { type: 'AttackResolved' }> => event.type === 'AttackResolved');
    if (!attackEvent) return result;

    let state = result.state;
    const events = [...result.events];
    const attack = attackEvent.data;
    const windows: Array<{ actorId: string; trigger: ReactionDecision['trigger']; targetId?: string; testRoll?: any }> = [
        { actorId: attack.attackerId, trigger: 'test-rolled', targetId: attack.defenderId, testRoll: attack.attackerRoll },
        { actorId: attack.defenderId, trigger: 'test-rolled', targetId: attack.attackerId, testRoll: attack.defenderRoll },
    ];
    if (attack.attackerRoll.roundedSuccessLevel < 0) windows.push({ actorId: attack.attackerId, trigger: 'test-failed', targetId: attack.defenderId, testRoll: attack.attackerRoll });
    if (attack.defenderRoll.roundedSuccessLevel < 0) windows.push({ actorId: attack.defenderId, trigger: 'test-failed', targetId: attack.attackerId, testRoll: attack.defenderRoll });
    if (attack.outcome === 'defender' && attack.defenderRoll.skillId === 'dodge') {
        windows.push({ actorId: attack.defenderId, trigger: 'won-Dodge-defence', targetId: attack.attackerId, testRoll: attack.defenderRoll });
    }
    if (attack.outcome === 'defender' && attack.defenderCanCrit) {
        windows.push({ actorId: attack.defenderId, trigger: 'won-defensive-Melee', targetId: attack.attackerId, testRoll: attack.defenderRoll });
    }
    if (result.events.some(event => event.type === 'CritRolled' && (event as any).data?.combatantId === attack.attackerId)) {
        windows.push({ actorId: attack.defenderId, trigger: 'scored-a-defensive-crit', targetId: attack.attackerId, testRoll: attack.defenderRoll });
    }

    const orderedWindows = windows.sort((a, b) => initiativeIndex(engine, a.actorId) - initiativeIndex(engine, b.actorId));
    for (const window of orderedWindows) {
        const choices = eligibleReactions(state, {
            trigger: window.trigger,
            actorId: window.actorId,
            targetId: window.targetId,
            attackEvent,
            testRoll: window.testRoll,
            depth: 0,
        }).sort((a, b) => initiativeIndex(engine, a.actorId) - initiativeIndex(engine, b.actorId) || String(a.reaction).localeCompare(String(b.reaction)));
        if (choices.length === 0) continue;
        events.push(...choices.map(choice => reactionOfferEvent(choice, initiativeIndex(engine, choice.actorId))));
        const actor = state.combatants[window.actorId];
        const controller = resolver?.(window.actorId);
        const choice = controller?.choose({
            level: 'resolution',
            reason: `reaction:${window.trigger}`,
            engine: { ...engine, state },
            state,
            actor,
            legalDecisions: choices as any,
            options: choices as any,
            parentDecision: parent,
            rng: engine.rng,
        }) as ReactionDecision | undefined;
        if (choice?.kind === 'reaction' && choices.some(candidate => candidate.reaction === choice.reaction && candidate.actorId === choice.actorId && candidate.targetId === choice.targetId)) {
            const resolved = resolveReactionDecision(state, choice, {
                trigger: window.trigger,
                actorId: window.actorId,
                targetId: window.targetId,
                attackEvent,
                testRoll: window.testRoll,
                depth: 0,
            }, engine.rng);
            state = resolved.state;
            events.push(...resolved.events);
            if (choice.decisionLog) events.push(decisionLogEvent(choice, 'resolution'));
        } else {
            events.push(turnEvent('ReactionResolved', 'combat.reaction.resolved', {
                trigger: window.trigger,
                actorId: window.actorId,
                targetId: window.targetId,
                reaction: choices[0].reaction,
                chosen: false,
                depth: 0,
            }));
        }
    }

    return { state, events };
}

function threadChargeReactions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, resolver?: ControllerResolver): CombatEngineResult {
    const target = parent.target ?? parent.destination;
    const chargedId = typeof target === 'object' && target && 'combatantId' in target ? target.combatantId : parent.targetId;
    if (!chargedId) return result;
    let state = result.state;
    const events = [...result.events];
    const choices = eligibleReactions(state, {
        trigger: 'charged',
        actorId: chargedId,
        targetId: parent.actorId,
        depth: 0,
    }).sort((a, b) => initiativeIndex(engine, a.actorId) - initiativeIndex(engine, b.actorId) || String(a.reaction).localeCompare(String(b.reaction)));
    if (choices.length === 0) return result;
    events.push(...choices.map(choice => reactionOfferEvent(choice, initiativeIndex(engine, choice.actorId))));
    const actor = state.combatants[chargedId];
    const controller = resolver?.(chargedId);
    const choice = controller?.choose({
        level: 'resolution',
        reason: 'reaction:charged',
        engine: { ...engine, state },
        state,
        actor,
        legalDecisions: choices as any,
        options: choices as any,
        parentDecision: parent,
        rng: engine.rng,
    }) as ReactionDecision | undefined;
    if (choice?.kind === 'reaction' && choices.some(candidate => candidate.reaction === choice.reaction && candidate.actorId === choice.actorId && candidate.targetId === choice.targetId)) {
        const resolved = resolveReactionDecision(state, choice, {
            trigger: 'charged',
            actorId: chargedId,
            targetId: parent.actorId,
            depth: 0,
        }, engine.rng);
        state = resolved.state;
        events.push(...resolved.events);
        if (choice.decisionLog) events.push(decisionLogEvent(choice, 'resolution'));
    } else {
        events.push(turnEvent('ReactionResolved', 'combat.reaction.resolved', {
            trigger: 'charged',
            actorId: chargedId,
            targetId: parent.actorId,
            reaction: choices[0].reaction,
            chosen: false,
            depth: 0,
        }));
    }
    return { state, events };
}

function withFateInterceptionChoice<TAction extends MeleeAttackAction | RangedAttackAction>(
    engine: TurnEngineState,
    resolver: ControllerResolver | undefined,
    defenderId: string,
    action: TAction
): { state: CombatState; action: TAction; events: CombatEvent[] } {
    const defender = engine.state.combatants[defenderId];
    if (!defender || (defender.resources.fate?.current ?? 0) <= 0) return { state: engine.state, action, events: [] };
    const controller = resolver?.(defenderId);
    if (!controller) return { state: engine.state, action, events: [] };
    const choice: ReactionDecision = { kind: 'reaction', actorId: defenderId, targetId: action.attackerId, trigger: 'damage-about-to-apply', reaction: 'howDidThatMiss' };
    const events = [reactionOfferEvent(choice, initiativeIndex(engine, defenderId))];
    const selected = controller.choose({
        level: 'resolution',
        reason: 'reaction:damage-about-to-apply',
        engine,
        state: engine.state,
        actor: defender,
        legalDecisions: [choice] as any,
        options: [choice] as any,
        parentDecision: { kind: 'reaction', actorId: defenderId } as CombatDecision,
        rng: engine.rng,
    }) as ReactionDecision | undefined;
    const chosen = selected?.kind === 'reaction' && selected.reaction === 'howDidThatMiss';
    if (selected?.decisionLog) events.push(decisionLogEvent(selected, 'resolution'));
    events.push(turnEvent('ReactionResolved', 'combat.reaction.resolved', {
        trigger: 'damage-about-to-apply',
        actorId: defenderId,
        targetId: action.attackerId,
        reaction: 'howDidThatMiss',
        chosen,
        depth: 0,
    }));
    return {
        state: engine.state,
        action: { ...action, fatePolicy: chosen ? 'always' : action.fatePolicy } as TAction,
        events,
    };
}

function threadDeathInterceptions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, resolver?: ControllerResolver): CombatEngineResult {
    const deaths = result.events.filter((event): event is Extract<CombatEvent, { type: 'CombatantDied' }> => event.type === 'CombatantDied');
    if (deaths.length === 0) return result;

    let state = result.state;
    let events = [...result.events];
    for (const death of deaths) {
        const combatantId = death.data.combatantId;
        const actor = state.combatants[combatantId];
        if (!actor || (actor.resources.fate?.current ?? 0) <= 0) continue;
        const controller = resolver?.(combatantId);
        if (!controller) continue;
        const choice: ReactionDecision = { kind: 'reaction', actorId: combatantId, trigger: 'would-die', reaction: 'dieAnotherDay' };
        events.push(reactionOfferEvent(choice, initiativeIndex(engine, combatantId)));
        const selected = controller.choose({
            level: 'resolution',
            reason: 'reaction:would-die',
            engine: { ...engine, state },
            state,
            actor,
            legalDecisions: [choice] as any,
            options: [choice] as any,
            parentDecision: parent,
            rng: engine.rng,
        }) as ReactionDecision | undefined;
        const chosen = selected?.kind === 'reaction' && selected.reaction === 'dieAnotherDay';
        if (selected?.decisionLog) events.push(decisionLogEvent(selected, 'resolution'));
        if (!chosen) {
            events.push(turnEvent('ReactionResolved', 'combat.reaction.resolved', {
                trigger: 'would-die',
                actorId: combatantId,
                reaction: 'dieAnotherDay',
                chosen: false,
                depth: 0,
            }));
            continue;
        }

        const spent = spendFate(state, combatantId, 'dieAnotherDay', { policy: 'always' });
        const surviving = spent.state.combatants[combatantId];
        const { dead: _dead, ...withoutDead } = surviving;
        state = {
            ...spent.state,
            combatants: {
                ...spent.state.combatants,
                [combatantId]: {
                    ...withoutDead,
                    currentWounds: 0,
                    removedFromEncounter: true,
                    conditions: withoutDead.conditions.includes('condition_unconscious') ? withoutDead.conditions : [...withoutDead.conditions, 'condition_unconscious'],
                    resources: {
                        ...withoutDead.resources,
                        wounds: { ...withoutDead.resources.wounds, current: 0 },
                    },
                    character: {
                        ...withoutDead.character,
                        status: {
                            ...withoutDead.character.status,
                            wounds: { ...withoutDead.character.status.wounds, current: 0 },
                        },
                    },
                },
            },
        };
        events = events.filter(event => event !== death);
        events.push(
            ...spent.events,
            turnEvent('FateInterceptionEvent', 'combat.fate.dieAnotherDay', {
                combatantId,
                action: 'dieAnotherDay',
                intercepted: 'death',
                removedFromEncounter: true,
            }),
            turnEvent('CombatantRemovedFromEncounter', 'combat.fate.removedFromEncounter', { combatantId, reason: 'dieAnotherDay' }),
            turnEvent('ReactionResolved', 'combat.reaction.resolved', {
                trigger: 'would-die',
                actorId: combatantId,
                reaction: 'dieAnotherDay',
                chosen: true,
                depth: 0,
            }),
        );
    }
    return { state, events };
}

function threadDamageInterceptions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, resolver?: ControllerResolver): CombatEngineResult {
    if (result.events.some(event => event.type === 'FateInterceptionEvent' && (event as any).data?.intercepted === 'damage')) return result;
    const damageEvents = result.events.filter((event): event is Extract<CombatEvent, { type: 'DamageDealt' }> => event.type === 'DamageDealt' && event.data.damageDealt > 0);
    if (damageEvents.length === 0) return result;

    let state = result.state;
    const events = [...result.events];
    for (const damage of damageEvents) {
        const defenderId = damage.data.defenderId;
        const defender = state.combatants[defenderId];
        if (!defender || (defender.resources.fate?.current ?? 0) <= 0) continue;
        const controller = resolver?.(defenderId);
        if (!controller) continue;
        const choice: ReactionDecision = { kind: 'reaction', actorId: defenderId, targetId: damage.data.attackerId, trigger: 'damage-about-to-apply', reaction: 'howDidThatMiss' };
        events.push(reactionOfferEvent(choice, initiativeIndex(engine, defenderId)));
        const selected = controller.choose({
            level: 'resolution',
            reason: 'reaction:damage-about-to-apply',
            engine: { ...engine, state },
            state,
            actor: defender,
            legalDecisions: [choice] as any,
            options: [choice] as any,
            parentDecision: parent,
            rng: engine.rng,
        }) as ReactionDecision | undefined;
        const chosen = selected?.kind === 'reaction' && selected.reaction === 'howDidThatMiss';
        if (selected?.decisionLog) events.push(decisionLogEvent(selected, 'resolution'));
        events.push(turnEvent('ReactionResolved', 'combat.reaction.resolved', {
            trigger: 'damage-about-to-apply',
            actorId: defenderId,
            targetId: damage.data.attackerId,
            reaction: 'howDidThatMiss',
            chosen,
            depth: 0,
        }));
        if (!chosen) continue;
        const spent = spendFate(state, defenderId, 'howDidThatMiss', { policy: 'always', incomingDamage: damage.data.damageDealt });
        const restored = spent.state.combatants[defenderId];
        state = {
            ...spent.state,
            combatants: {
                ...spent.state.combatants,
                [defenderId]: {
                    ...restored,
                    currentWounds: damage.data.woundsBefore,
                    resources: {
                        ...restored.resources,
                        wounds: { ...restored.resources.wounds, current: damage.data.woundsBefore },
                    },
                    character: {
                        ...restored.character,
                        status: {
                            ...restored.character.status,
                            wounds: { ...restored.character.status.wounds, current: damage.data.woundsBefore },
                        },
                    },
                },
            },
        };
        events.push(
            ...spent.events,
            turnEvent('FateInterceptionEvent', 'combat.fate.howDidThatMiss', {
                combatantId: defenderId,
                action: 'howDidThatMiss',
                intercepted: 'damage',
                damageNegated: damage.data.damageDealt,
            }),
        );
    }
    return { state, events };
}

function applyQualityActivationChoice(state: CombatState, actorId: string, targetId: string | undefined, qualityId: string, effect: string | undefined, cost: number): CombatEngineResult {
    const actor = state.combatants[actorId];
    if (!actor || !targetId || cost <= 0) return { state, events: [decisionRejected({ kind: 'spendAdvantage', actorId }, 'invalidQualityActivation')] };
    const available = state.advantagePools[actor.side];
    if (available < cost) {
        return {
            state,
            events: [turnEvent('AdvantageSpendRejectedEvent', 'combat.advantage.spendRejected.insufficientAdvantage', {
                side: actor.side,
                action: effect ?? qualityId,
                cost,
                available,
                reason: 'insufficientAdvantage',
                actorId,
            })],
        };
    }

    let currentState: CombatState = {
        ...state,
        advantagePools: { ...state.advantagePools, [actor.side]: available - cost },
    };
    const events: CombatEvent[] = [turnEvent('AdvantageSpentEvent', 'combat.advantage.spent', {
        side: actor.side,
        action: effect ?? qualityId,
        amount: cost,
        poolBefore: available,
        poolAfter: available - cost,
        actorId,
    })];

    if (qualityId === 'trip') {
        currentState = applyConditionStacks(currentState, targetId, 'condition_prone', 1);
        events.push(turnEvent('ConditionApplied', 'combat.condition.applied', { targetId, conditionId: 'condition_prone', stacks: 1 }));
    } else if (qualityId === 'slash' && effect === 'slashExtraBleeding') {
        currentState = applyConditionStacks(currentState, targetId, 'condition_bleeding', cost);
        events.push(turnEvent('ConditionApplied', 'combat.condition.applied', { targetId, conditionId: 'condition_bleeding', stacks: cost }));
    }

    events.push(turnEvent('QualityEffectApplied', `combat.quality.${qualityId}.activated`, { combatantId: actorId, targetId, qualityId, effect: effect ?? 'activated', amount: cost }));
    return { state: currentState, events };
}

function applyConditionStacks(state: CombatState, combatantId: string, conditionId: string, stacks: number): CombatState {
    const combatant = state.combatants[combatantId];
    if (!combatant) return state;
    const nonStacking = ['condition_prone', 'condition_surprised', 'condition_unconscious'];
    const additions = nonStacking.includes(conditionId) && combatant.conditions.includes(conditionId)
        ? []
        : Array.from({ length: Math.max(1, stacks) }, () => conditionId);
    return replaceCombatant(state, { ...combatant, conditions: [...combatant.conditions, ...additions] });
}

function chooseResolution(
    engine: TurnEngineState,
    controller: CombatantController | undefined,
    actorId: string,
    reason: string,
    options: CombatDecision[],
    parentDecision: CombatDecision
): CombatDecision | undefined {
    const actor = engine.state.combatants[actorId];
    return controller?.choose({
        level: 'resolution',
        reason,
        engine,
        state: engine.state,
        actor,
        legalDecisions: options as LegalDecision[],
        options,
        parentDecision,
        rng: engine.rng,
    });
}

function actionBudgetReady(actor: Combatant): boolean {
    const capabilities = combatantCapabilities(actor);
    return actor.budget.actions > 0 && capabilities.canAct;
}

function meleeBudgetReady(state: CombatState, actor: Combatant): boolean {
    const capabilities = combatantCapabilities(actor);
    return capabilities.canAct
        && (actor.budget.actions > 0 || frenzyFreeMeleeAvailable(state, actor));
}

function frenzyFreeMeleeAvailable(state: CombatState, actor: Combatant): boolean {
    const usedIds = state.turnFlags.frenzyFreeAttackCombatantIds ?? [];
    return isFrenzied(actor)
        && actor.psychology?.frenzy?.freeMeleeTestUsedRound !== state.round
        && !usedIds.includes(actor.id);
}

function consumeFrenzyFreeMelee(state: CombatState, actorId: string, events: CombatEvent[]): CombatEngineResult {
    const marked = markFrenzyFreeMeleeUsed(state, actorId);
    const usedIds = marked.turnFlags.frenzyFreeAttackCombatantIds ?? [];
    return {
        state: {
            ...marked,
            turnFlags: {
                ...marked.turnFlags,
                frenzyFreeAttackCombatantIds: [
                    ...new Set([...usedIds, actorId]),
                ],
            },
        },
        events,
    };
}

function frenzyLegalDecisions(
    state: CombatState,
    actor: Combatant,
    legal: LegalDecision[]
): LegalDecision[] {
    const nearest = nearestEnemy(state, actor);
    if (!nearest) {
        return legal.filter(decision => decision.kind === 'endTurn' || decision.kind === 'frenzyExit');
    }

    const meleeKinds = new Set<CombatDecisionKind>([
        'meleeAttack',
        'attackWithBoth',
        'beatBlade',
        'disarm',
        'feint',
        'infighting',
    ]);
    const constrained = legal.filter(decision =>
        (decision.kind === 'frenzyExit')
        || (meleeKinds.has(decision.kind) && decision.targetId === nearest.id)
    );

    const reach = meleeReach(state, actor);
    const distance = Math.abs(nearest.position - actor.position);
    if (actor.budget.moves > 0 && combatantCapabilities(actor).canMove && distance > reach) {
        const allowance = Math.min(actor.movementBudget.run, actor.movementBudget.remaining);
        const distanceToClose = Math.max(0, distance - reach);
        const movement = Math.min(allowance, distanceToClose);
        if (movement > 0) {
            const direction = Math.sign(nearest.position - actor.position);
            constrained.push({
                kind: 'move',
                actorId: actor.id,
                mode: 'run',
                target: actor.position + direction * movement,
                destination: actor.position + direction * movement,
                targetId: nearest.id,
                targetIds: [nearest.id],
                reason: 'frenzyCloseNearest',
            });
        }
    }
    return constrained.length > 0
        ? constrained
        : legal.filter(decision => decision.kind === 'endTurn');
}

function nearestEnemy(state: CombatState, actor: Combatant): Combatant | undefined {
    return enemyIds(state, actor)
        .map(id => state.combatants[id])
        .sort((a, b) =>
            Math.abs(a.position - actor.position) - Math.abs(b.position - actor.position)
            || a.id.localeCompare(b.id)
        )[0];
}

function meleeReach(state: CombatState, actor: Combatant): number {
    const weapon = state.weapons.find(candidate =>
        candidate.id === (actor.weaponLoadout?.primaryWeaponId ?? '')
    );
    return REACH_ENGAGEMENT_DISTANCE[(weapon?.reach as WeaponReach) ?? 'Short'];
}

function combatActionBudgetReady(actor: Combatant, kind: CombatActionKind): boolean {
    const capabilities = combatantCapabilities(actor);
    if (!capabilities.canAct) return false;
    if (kind === 'grappleBreak') return true;
    if (kind === 'distractOpponent') return actor.budget.moves > 0;
    return actor.budget.actions > 0;
}

function combatActionTalentReady(actor: Combatant, kind: CombatActionKind): boolean {
    const talentMap: Partial<Record<CombatActionKind, string>> = {
        attackWithBoth: 'dual-wielder',
        beatBlade: 'beat-blade',
        disarm: 'disarm',
        feint: 'feint',
        distractOpponent: 'distract',
    };
    const talentId = talentMap[kind];
    return !talentId || hasTalent(actor, talentId);
}

function talentPolicyFor(kind: CombatActionKind): CombatActionRequest['policy'] | undefined {
    return ['beatBlade', 'disarm', 'feint', 'distractOpponent'].includes(kind) ? 'always' : undefined;
}

function advantageSpendDecisions(state: CombatState, actor: Combatant): LegalDecision[] {
    const pool = state.advantagePools[actor.side];
    const decisions: LegalDecision[] = [];
    if (pool >= 1) {
        decisions.push(
            { kind: 'spendAdvantage', actorId: actor.id, advantageAction: 'additionalEffort', reason: 'additionalEffort' },
            ...enemyIds(state, actor).filter(targetId => !state.combatants[targetId]?.conditions.includes('condition_prone')).map(targetId => ({ kind: 'spendAdvantage' as const, actorId: actor.id, targetId, targetIds: [targetId], advantageAction: 'batter' as const, reason: 'batter' })),
            ...enemyIds(state, actor).map(targetId => ({ kind: 'spendAdvantage' as const, actorId: actor.id, targetId, targetIds: [targetId], advantageAction: 'trick' as const, reason: 'trick' })),
        );
    }
    if (pool >= 2 && actor.engagementIds.length > 0) {
        decisions.push({ kind: 'spendAdvantage', actorId: actor.id, advantageAction: 'fleeFromHarm', reason: 'fleeFromHarm' });
    }
    if (pool >= 4 && !state.turnFlags.additionalActionCombatantIds.includes(actor.id)) {
        decisions.push({ kind: 'spendAdvantage', actorId: actor.id, advantageAction: 'additionalAction', reason: 'additionalAction' });
    }
    if (hasTalent(actor, 'furious-assault') && pool > 0 && actor.budget.moves > 0) {
        decisions.push({ kind: 'spendAdvantage', actorId: actor.id, advantageAction: 'furiousAssault', reason: 'furiousAssault' });
    }
    return decisions;
}

function enemyIds(state: CombatState, actor: Combatant): string[] {
    return Object.values(state.combatants).filter(other => other.side !== actor.side && isActive(other)).map(other => other.id);
}

function reloadableWeaponIds(state: CombatState, actor: Combatant): string[] {
    return state.weapons
        .filter(weapon => actor.character.inventory.weapons?.[weapon.id] > 0 || actor.weaponLoadout?.primaryWeaponId === weapon.id || actor.weaponLoadout?.secondaryWeaponId === weapon.id)
        .filter(weapon => (qualityRating(weapon, 'reload') ?? 0) > 0)
        .filter(weapon => {
            const ammo = actor.weaponAmmo?.[weapon.id];
            return !ammo || !ammo.loaded || !!ammo.reloadProgress;
        })
        .map(weapon => weapon.id);
}

function hasTalent(actor: Combatant, talentId: string): boolean {
    return (actor.character.talents?.[talentId] ?? 0) > 0;
}

function decisionRejected(decision: CombatDecision, reason: string): CombatEvent {
    return turnEvent('TurnDecisionRejected', 'combat.turn.rejected.illegal', { actorId: decision.actorId, reason, decision: decision.kind });
}

// Offers a Fortune-reroll to each remote combatant who just failed a Terror test.
// Called in the roundStart block after resolvePsychologyRoundStart so the full TurnEngineState
// is available as context. Returns an updated CombatEngineResult (state + supplementary events).
function offerPsychologyFortuneRerolls(
    engineRef: TurnEngineState,
    psychResult: CombatEngineResult,
    rng: Rng,
    resolver: ControllerResolver,
): CombatEngineResult {
    let currentState = psychResult.state;
    const events: CombatEvent[] = [...psychResult.events];

    for (const event of psychResult.events) {
        if (event.type !== 'PsychologyTestResolved') continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = (event as any).data as {
            combatantId: string; sourceId: string; psychology: string;
            roll: number; targetNumber: number; successLevel: number; brokenApplied?: number;
        };
        if (d.psychology !== 'terror' || !d.brokenApplied || d.brokenApplied <= 0) continue;

        const combatant = currentState.combatants[d.combatantId];
        if (!combatant || (combatant.resources.fortune?.current ?? 0) <= 0) continue;

        const controller = resolver(combatant.id);
        if (!controller) continue;

        const decision = controller.choose({
            level: 'resolution',
            reason: 'psychology:fortune',
            engine: engineRef,
            state: currentState,
            actor: combatant,
            legalDecisions: [
                { kind: 'fortuneReroll', actorId: combatant.id },
                { kind: 'wait', actorId: combatant.id },
            ],
            rng,
        });

        if (decision?.kind !== 'fortuneReroll') continue;

        // Spend 1 Fortune (policy: 'always' — we already checked current > 0)
        const fortuneResult = spendFortune(currentState, combatant.id, 'reroll', { policy: 'always' }, rng);
        currentState = fortuneResult.state;
        events.push(...fortuneResult.events);

        const postFortune = currentState.combatants[d.combatantId];

        // Remove the broken stacks that were applied by the original failure
        let toRemove = d.brokenApplied;
        const cleanedConditions = postFortune.conditions.filter(
            c => (c === 'condition_broken' && toRemove-- > 0) ? false : true,
        );

        // Derive terror rating from stored psychology state
        const rating = postFortune.psychology?.terrors[d.sourceId]?.rating ?? 1;
        const modifier = -10 * rating;

        // Reroll with the same modifier as the original terror test
        const retest = resolveCoolTest(postFortune, rng, modifier);
        const newBrokenApplied = retest.successLevel < 0
            ? rating + Math.abs(Math.round(retest.successLevel))
            : 0;

        const newConditions = newBrokenApplied > 0
            ? [...cleanedConditions, ...Array(newBrokenApplied).fill('condition_broken')]
            : cleanedConditions;

        const updatedPsychology = postFortune.psychology ? {
            ...postFortune.psychology,
            terrors: {
                ...postFortune.psychology.terrors,
                [d.sourceId]: {
                    ...postFortune.psychology.terrors[d.sourceId],
                    successLevel: retest.successLevel,
                    brokenApplied: newBrokenApplied,
                },
            },
        } : postFortune.psychology;

        currentState = {
            ...currentState,
            combatants: {
                ...currentState.combatants,
                [d.combatantId]: { ...postFortune, conditions: newConditions, psychology: updatedPsychology },
            },
        };

        events.push({
            type: 'PsychologyTestResolved',
            i18nKey: 'combat.psychology.terror.fortuneReroll',
            data: {
                combatantId: d.combatantId,
                sourceId: d.sourceId,
                psychology: 'terror' as const,
                roll: retest.roll,
                targetNumber: retest.targetNumber,
                successLevel: retest.successLevel,
                brokenApplied: newBrokenApplied,
            },
        });
    }

    return { state: currentState, events };
}

function stepAutomatic(engine: TurnEngineState, options: TurnEngineOptions, resolver?: ControllerResolver): TurnEngineState {
    if (engine.phase === 'setup') {
        let state = {
            ...engine.state,
            combatants: Object.fromEntries(Object.values(determineSurprise(Object.values(engine.state.combatants), options)).map(combatant => [combatant.id, combatant])),
        };
        state = { ...state, advantagePools: seedInitialAdvantage({ state, ...options.initialAdvantage }) };
        const start = turnEvent('CombatStarted', 'combat.turn.started', { round: state.round });
        return { ...engine, state, phase: 'roundStart', events: engine.events.concat(start) };
    }

    if (engine.phase === 'roundStart') {
        const round = engine.round + 1;
        const resetState = resetRoundState({ ...engine.state, round });
        const frenzyExit = resolveFrenzyExits(resetState);
        const psychology = resolvePsychologyRoundStart(frenzyExit.state, engine.rng);
        // Offer Fortune-rerolls to remote players who failed Terror tests (parallel fan-out in LP-b orchestrator)
        const roundStartResult = resolver ? offerPsychologyFortuneRerolls(engine, psychology, engine.rng, resolver) : psychology;
        const state = roundStartResult.state;
        // Initiative is rolled once at the start of combat and kept for the encounter;
        // later rounds reuse the established order, skipping combatants no longer active.
        const order = engine.initiativeOrder.length > 0 ? engine.initiativeOrder : initiativeOrderFor(state, engine.rng);
        const firstActiveIndex = order.findIndex(id => isActive(state.combatants[id]));
        const firstActiveId = firstActiveIndex >= 0 ? order[firstActiveIndex] : undefined;
        return {
            ...engine,
            state,
            round,
            initiativeOrder: order,
            turnIndex: firstActiveIndex >= 0 ? firstActiveIndex : 0,
            phase: firstActiveId ? 'awaitingDecision' : 'complete',
            activeCombatantId: firstActiveId,
            events: [
                ...engine.events,
                turnEvent('RoundStarted', 'combat.turn.roundStarted', { round }),
                ...frenzyExit.events,
                ...roundStartResult.events,
                ...(firstActiveId ? [turnEvent('TurnStarted', 'combat.turn.startedActor', { round, combatantId: firstActiveId })] : []),
            ],
        };
    }

    if (engine.phase === 'roundEnd') {
        let result = applyEndOfRound(engine.state, engine.rng);
        const terminated = termination(result.state, engine.maxRounds);
        if (terminated) {
            return {
                ...engine,
                state: result.state,
                events: [...engine.events, ...result.events, turnEvent('CombatEnded', 'combat.turn.ended', {
                    outcome: terminated.outcome,
                    reason: terminated.terminalReason,
                })],
                ...terminated,
            };
        }
        return {
            ...engine,
            state: result.state,
            phase: 'roundStart',
            activeCombatantId: undefined,
            events: [
                ...engine.events,
                ...result.events,
            ]
        };
    }

    return engine;
}

function finishTurn(engine: TurnEngineState): TurnEngineState {
    const result = resetAdditionalEffortBuff(engine.state, engine.activeCombatantId!);
    let currentState = result.state;
    let extraEvents: CombatEvent[] = [...result.events];

    const endedId = engine.activeCombatantId!;

    // Stout-Hearted: end-of-turn Cool Test to shed Broken (in addition to end-of-round)
    const endedCombatant = currentState.combatants[endedId];
    if (endedCombatant
        && endedCombatant.conditions.includes('condition_broken')
        && hasTalent(endedCombatant, 'stout-hearted')
        && endedCombatant.engagementIds.length === 0
    ) {
        const stoutRally = resolveEndOfTurnBrokenRally(currentState, endedId, engine.rng);
        currentState = stoutRally.state;
        extraEvents.push(...stoutRally.events);
    }

    // Flee-field check: Broken + unengaged + far enough from all enemies → removedFromEncounter
    for (const combatantId of Object.keys(currentState.combatants)) {
        const fleeCheck = resolveFleeFromFieldCheck(currentState, combatantId);
        if (fleeCheck.events.length > 0) {
            currentState = fleeCheck.state;
            extraEvents.push(...fleeCheck.events);
        }
    }

    const nextEngine = { ...engine, state: currentState, events: [...engine.events, ...extraEvents] };

    const nextIndex = nextEngine.turnIndex + 1;
    const nextId = nextEngine.initiativeOrder.slice(nextIndex).find(id => isActive(nextEngine.state.combatants[id]));
    const events = [...nextEngine.events, turnEvent('TurnEnded', 'combat.turn.endedActor', { round: nextEngine.round, combatantId: endedId })];
    const terminated = sideDownTermination(nextEngine.state);
    if (terminated) {
        return {
            ...nextEngine,
            events: [...events, turnEvent('CombatEnded', 'combat.turn.ended', {
                outcome: terminated.outcome,
                reason: terminated.terminalReason,
            })],
            ...terminated,
        };
    }
    if (!nextId) {
        return { ...nextEngine, phase: 'roundEnd', activeCombatantId: undefined, turnIndex: nextIndex, events };
    }
    return {
        ...nextEngine,
        phase: 'awaitingDecision',
        activeCombatantId: nextId,
        turnIndex: nextIndex,
        events: [...events, turnEvent('TurnStarted', 'combat.turn.startedActor', { round: nextEngine.round, combatantId: nextId })],
    };
}

function applyEndOfRound(state: CombatState, rng: Rng): CombatEngineResult {
    let currentState = state;
    const events: CombatEvent[] = [turnEvent('RoundEnded', 'combat.turn.roundEnded', { round: state.round, step: 'roundEndStart' })];

    for (const combatant of Object.values(currentState.combatants)) {
        const condition = applyEndOfRoundConditionEffects(combatant, currentState.round, combatant.character, { rng });
        currentState = replaceCombatant(currentState, condition.combatant as Combatant);
        events.push(...condition.events as unknown as CombatEvent[]);
        if (condition.dead) {
            currentState = replaceCombatant(currentState, { ...currentState.combatants[combatant.id], dead: true });
        }
        for (const pendingTest of condition.pendingTests) {
            if (pendingTest.conditionId === 'condition_broken') {
                // Use resolveCoolTest path so Leadership's psychologyTestBonus applies
                const rally = resolveEndOfRoundBrokenRally(currentState, combatant.id, rng);
                currentState = rally.state;
                events.push(...rally.events);
            } else {
                const resolved = resolveConditionPendingTest(condition.combatant, pendingTest, rng);
                currentState = replaceCombatant(currentState, resolved.combatant as Combatant);
                events.push(...resolved.events as unknown as CombatEvent[]);
            }
        }
    }

    const advantage = reallocateEndOfRound(currentState);
    currentState = advantage.state;
    events.push(...advantage.events);

    const decay = decayEngagementsEndOfRound(currentState);
    currentState = decay.state;
    events.push(...decay.events);

    for (const combatantId of Object.keys(currentState.combatants)) {
        const death = accumulatedCriticalDeathCheck(currentState, combatantId);
        currentState = death.state;
        events.push(...death.events);
    }

    const frenzyExit = resolveFrenzyExits(currentState);
    currentState = frenzyExit.state;
    events.push(...frenzyExit.events);

    const psychologyBonusExpiry = expirePsychologyBonuses(currentState);
    currentState = psychologyBonusExpiry.state;
    events.push(...psychologyBonusExpiry.events);

    events.push(turnEvent('RoundSequenceResolved', 'combat.turn.roundSequenceResolved', { round: state.round, sequence: 'conditions>advantage>engagements>death>removal' }));
    return { state: currentState, events };
}

function initiativeOrderFor(state: CombatState, rng: Rng): string[] {
    return Object.values(state.combatants)
        .filter(isActive)
        .map(combatant => {
            const roll = Math.floor(rng.next() * 10) + 1;
            const fast = equippedWeaponHas(state, combatant, 'fast') || (combatant.character.talents?.['fast-shot'] ?? 0) > 0;
            const slow = equippedWeaponHas(state, combatant, 'slow');
            return {
                id: combatant.id,
                initiative: calculateCharacteristicValue(combatant.character.characteristics.ag) + roll,
                ag: calculateCharacteristicValue(combatant.character.characteristics.ag),
                i: calculateCharacteristicValue(combatant.character.characteristics.i),
                override: combatant.initiativeOverride ? 1 : 0,
                fast: fast ? 1 : 0,
                slow: slow ? 1 : 0,
                name: combatant.name,
            };
        })
        .sort((a, b) => (
            b.override - a.override
            || b.fast - a.fast
            || a.slow - b.slow
            || b.initiative - a.initiative
            || b.ag - a.ag
            || b.i - a.i
            || a.name.localeCompare(b.name)
            || a.id.localeCompare(b.id)
        ))
        .map(entry => entry.id);
}

function resetRoundState(state: CombatState): CombatState {
    return {
        ...state,
        combatants: Object.fromEntries(Object.values(state.combatants).map(combatant => [combatant.id, {
            ...combatant,
            budget: { actions: 1, moves: 1, reactions: 1 },
            movementBudget: { ...combatant.movementBudget, remaining: combatant.movementBudget.run },
            initiativeOverride: false,
        }])),
        turnFlags: {
            additionalActionCombatantIds: [],
            chargedCombatantIds: [],
            frenzyFreeAttackCombatantIds: [],
            talentExtraAttackCombatantIds: [],
            shieldsmanUsedThisTurnIds: [],
            reactionStrikeChargerPairs: [],
        },
    };
}

function initiativeIndex(engine: TurnEngineState, combatantId: string): number {
    const index = engine.initiativeOrder.indexOf(combatantId);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function spendTurnAction(state: CombatState, actorId: string, events: CombatEvent[]): CombatEngineResult {
    const actor = state.combatants[actorId];
    return {
        state: replaceCombatant(state, { ...actor, budget: { ...actor.budget, actions: Math.max(0, actor.budget.actions - 1) } }),
        events,
    };
}

function applyFuriousAssault(state: CombatState, actorId: string): CombatEngineResult {
    const actor = state.combatants[actorId];
    if (!actor || (actor.character.talents?.['furious-assault'] ?? 0) <= 0 || state.advantagePools[actor.side] <= 0 || actor.budget.moves <= 0) {
        return { state, events: [turnEvent('TurnDecisionRejected', 'combat.turn.rejected.illegal', { actorId, reason: 'furiousAssault' })] };
    }
    return {
        state: {
            ...state,
            advantagePools: {
                ...state.advantagePools,
                [actor.side]: state.advantagePools[actor.side] - 1,
            },
            turnFlags: {
                ...state.turnFlags,
                talentExtraAttackCombatantIds: [...new Set([...state.turnFlags.talentExtraAttackCombatantIds, actor.id])],
            },
            combatants: {
                ...state.combatants,
                [actor.id]: {
                    ...actor,
                    budget: {
                        ...actor.budget,
                        moves: actor.budget.moves - 1,
                        actions: actor.budget.actions + 1,
                    },
                },
            },
        },
        events: [
            turnEvent('AdvantageSpentEvent', 'combat.advantage.spent', { side: actor.side, action: 'furiousAssault', amount: 1, actorId }),
            turnEvent('TalentEffectApplied', 'combat.talent.furious-assault.extraAttack', { combatantId: actor.id, talentId: 'furious-assault', effect: 'extraAttack', amount: 1 }),
        ],
    };
}

function shouldEndTurn(engine: TurnEngineState, actorId: string, decisionKind: CombatDecisionKind): boolean {
    if (decisionKind === 'endTurn' || decisionKind === 'wait') return true;
    const actor = engine.state.combatants[actorId];
    if (!actor) return true;
    const freeMeleeAvailable = frenzyFreeMeleeAvailable(engine.state, actor)
        && legalDecisions(engine.state, actor).some(decision => decision.kind === 'meleeAttack');
    return actor.budget.actions <= 0 && actor.budget.moves <= 0 && !freeMeleeAvailable;
}

function termination(state: CombatState, maxRounds: number): Pick<TurnEngineState, 'phase' | 'outcome' | 'terminalReason'> | undefined {
    const sideDown = sideDownTermination(state);
    if (sideDown) return sideDown;
    if (state.round >= maxRounds) return { phase: 'complete', outcome: 'draw', terminalReason: 'maxRounds' };
    return undefined;
}

function sideDownTermination(state: CombatState): Pick<TurnEngineState, 'phase' | 'outcome' | 'terminalReason'> | undefined {
    const aliveSides = new Set(Object.values(state.combatants).filter(isActive).map(combatant => combatant.side));
    if (!aliveSides.has('ally')) return { phase: 'complete', outcome: 'adversary', terminalReason: 'sideDown' };
    if (!aliveSides.has('adversary')) return { phase: 'complete', outcome: 'ally', terminalReason: 'sideDown' };
    return undefined;
}

function complete(engine: TurnEngineState, outcome: 'ally' | 'adversary' | 'draw', reason: 'sideDown' | 'maxRounds'): TurnEngineState {
    return {
        ...engine,
        phase: 'complete',
        outcome,
        terminalReason: reason,
        events: [...engine.events, turnEvent('CombatEnded', 'combat.turn.ended', { outcome, reason })],
    };
}

function rejectDecision(engine: TurnEngineState, decision: CombatDecision, reason: string): TurnEngineState {
    return withEvents(engine, [turnEvent('TurnDecisionRejected', 'combat.turn.rejected.illegal', { actorId: decision.actorId, reason, decision: decision.kind })]);
}

function withEvents(engine: TurnEngineState, events: CombatEvent[]): TurnEngineState {
    return { ...engine, events: [...engine.events, ...events] };
}

function appendDecisionLog(result: CombatEngineResult, decision: CombatDecision, level: 'turn' | 'resolution'): CombatEngineResult {
    return decision.decisionLog
        ? { state: result.state, events: [...result.events, decisionLogEvent(decision, level)] }
        : result;
}

function canUseRangedWeapon(state: CombatState, combatant: Combatant): boolean {
    const weapon = equippedWeapon(state, combatant);
    if (!weapon) return false;
    if (combatant.engagementIds.length > 0 && !hasQuality(weapon, 'pistol')) return false;
    return resolveWeaponUse(combatant, weapon).usable && !reloadBlocked(combatant, weapon.id);
}

function isInRange(other: Combatant, combatant: Combatant, weapon: Weapon): boolean {
    const distance = Math.abs(other.position - combatant.position);
    const weaponRange = rangedWeaponRange(weapon);
    const rangeBand = rangeBandForDistance(distance, weaponRange);
    return rangeBand !== 'outOfRange';
}

function enemyInRange(state: CombatState, combatant: Combatant): boolean {
    const weapon = equippedWeapon(state, combatant);
    if (!weapon) return false;

    return Object.values(state.combatants)
        .filter(other => other.side !== combatant.side && isActive(other))
        .some(other => isInRange(other, combatant, weapon))
}

function canReload(state: CombatState, combatant: Combatant): boolean {
    const weapon = equippedWeapon(state, combatant);
    if (!weapon) return false;
    const ammo = combatant.weaponAmmo?.[weapon.id];
    return (qualityRating(weapon, 'reload') ?? 0) > 0 && (!ammo || !ammo.loaded || !!ammo.reloadProgress);
}

function reloadBlocked(combatant: Combatant, weaponId: string): boolean {
    const ammo = combatant.weaponAmmo?.[weaponId];
    return !!ammo && (!ammo.loaded || !!ammo.reloadProgress || (ammo.shotsRemaining !== undefined && ammo.shotsRemaining <= 0));
}

function equippedWeapon(state: CombatState, combatant: Combatant): Weapon | undefined {
    const weaponId = combatant.weaponLoadout?.primaryWeaponId
        ?? Object.entries(combatant.character.inventory.equippedWeapons || {}).find(([, equipped]) => equipped)?.[0];
    return weaponId ? state.weapons.find(weapon => weapon.id === weaponId) : undefined;
}

function equippedWeaponHas(state: CombatState, combatant: Combatant, qualityId: string): boolean {
    const weapon = equippedWeapon(state, combatant);
    return !!weapon && hasQuality(weapon, qualityId);
}

export function isActive(combatant: Combatant | undefined): boolean {
    return !!combatant && combatant.currentWounds > 0 && !combatant.removedFromEncounter && !combatant.dead && !combatant.conditions.includes('condition_unconscious');
}

function isController(value: Record<string, CombatantController> | CombatantController): value is CombatantController {
    return typeof (value as CombatantController).choose === 'function';
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

function structuredCloneSafe<T>(value: T): T {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function turnEvent(type: string, i18nKey: string, data: Record<string, unknown>): CombatEvent {
    return { type, i18nKey, data } as CombatEvent;
}

function decisionLogEvent(decision: CombatDecision, level: 'turn' | 'resolution'): CombatEvent {
    return turnEvent('DecisionLogged', `combat.decision.${decision.decisionLog?.reasonCode ?? 'unknown'}`, {
        actorId: decision.actorId,
        level,
        chosen: decision.decisionLog?.chosen ?? decision.kind,
        reasonCode: decision.decisionLog?.reasonCode ?? 'unknown',
        rejectedAlternatives: decision.decisionLog?.rejectedAlternatives ?? [],
    });
}
