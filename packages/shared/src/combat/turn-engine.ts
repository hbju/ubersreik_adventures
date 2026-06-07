import { applyEndOfRoundConditionEffects, combatantCapabilities } from '../utils/conditions';
import { calculateCharacteristicValue } from '../utils/skills';
import { consumeAdditionalEffortBuff, reallocateEndOfRound, resetAdditionalEffortBuff, seedInitialAdvantage, spendAdvantage, type InitialAdvantageConfig } from './advantage';
import { isGrapplingEngagement, resolveCombatAction, resolveEffectiveWeapon } from './actions';
import { decayEngagementsEndOfRound, determineSurprise, resolveMeleeAttack, resolveRangedAttack, resolveRangedIntoMeleeAttack, resolveReloadAction } from './engine';
import { applyMove, REACH_ENGAGEMENT_DISTANCE, WeaponReach, type MoveTarget } from './spatial';
import { resolveWeaponUse } from './proficiency';
import { hasQuality, qualityRating } from './qualities';
import { eligibleReactions, reactionOfferEvent, resolveReactionDecision, type ReactionDecision } from './reactions';
import { spendFate } from './resources';
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
    RangedAttackAction,
    ReloadAction,
    SideId,
} from './types';
import { accumulatedCriticalDeathCheck } from './critical';
import type { Weapon } from '../types/wfrp.types';
import { rolld100 } from '../utils/mechanics';

export type TurnEnginePhase = 'setup' | 'roundStart' | 'awaitingDecision' | 'roundEnd' | 'complete';
export type CombatDecisionKind =
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
    | 'wait';

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

export class ScriptedController implements CombatantController {
    private index = 0;

    constructor(private readonly decisions: Array<CombatDecision | ((context: DecisionContext) => CombatDecision | undefined)>) {}

    choose(context: DecisionContext): CombatDecision | undefined {
        const next = this.decisions[this.index++];
        return typeof next === 'function' ? next(context) : next;
    }
}

export interface ActionCatalogueEntry {
    kind: CombatDecisionKind;
    legal(state: CombatState, actor: Combatant): LegalDecision[];
    dispatch(engine: TurnEngineState, decision: CombatDecision, controller?: CombatantController): CombatEngineResult;
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
    };
}

export function advanceToNextDecision(engine: TurnEngineState, options: TurnEngineOptions = {}): TurnEngineState {
    let current: TurnEngineState = engine;
    while (current.phase !== 'awaitingDecision' && current.phase !== 'complete') {
        current = stepAutomatic(current, options);
    }
    return current;
}

export function applyDecision(engine: TurnEngineState, decision: CombatDecision, controller?: CombatantController): TurnEngineState {
    if (engine.phase !== 'awaitingDecision' || !engine.activeCombatantId) return engine;
    if (decision.actorId !== engine.activeCombatantId) {
        return withEvents(engine, [turnEvent('TurnDecisionRejected', 'combat.turn.rejected.wrongActor', { actorId: decision.actorId, activeCombatantId: engine.activeCombatantId, reason: 'wrongActor' })]);
    }

    const actor = engine.state.combatants[decision.actorId];
    const legal = legalDecisions(engine.state, actor);
    if (!legal.some(candidate => matchesLegalDecision(candidate, decision))) {
        return withEvents(engine, [turnEvent('TurnDecisionRejected', 'combat.turn.rejected.illegal', { actorId: decision.actorId, reason: 'illegal', decision: decision.kind })]);
    }

    const entry = ACTION_CATALOGUE.find(candidate => candidate.kind === decision.kind);
    if (!entry) return rejectDecision(engine, decision, 'missingHandler');
    let result = entry.dispatch(engine, decision, controller);
    result = threadDeferredResolutionDecisions(engine, decision, result, controller);
    result = threadDamageInterceptions({ ...engine, state: result.state }, decision, result, controller);
    result = threadDeathInterceptions({ ...engine, state: result.state }, decision, result, controller);
    result = appendDecisionLog(result, decision, 'turn');

    const next = {
        ...engine,
        state: result.state,
        events: [...engine.events, ...result.events],
    };
    return shouldEndTurn(next, decision.actorId, decision.kind)
        ? finishTurn(next)
        : { ...next, phase: 'awaitingDecision' };
}

export function runCombatToCompletion(
    state: CombatState,
    controllers: Record<string, CombatantController> | CombatantController,
    options: TurnEngineOptions = {}
): TurnEngineState {
    let engine = createTurnEngine(state, options);
    let guard = 0;
    const maxRounds = options.maxRounds ?? 50;
    while (engine.phase !== 'complete' && guard++ < maxRounds * Math.max(1, Object.keys(state.combatants).length) * 20) {
        engine = advanceToNextDecision(engine, options);
        if (engine.phase === 'complete' || !engine.activeCombatantId) break;
        const actor = engine.state.combatants[engine.activeCombatantId];
        const controller = controllerFor(controllers, actor.id);
        const decision = controller?.choose({
            level: 'turn',
            engine,
            state: engine.state,
            actor,
            legalDecisions: legalDecisions(engine.state, actor),
            rng: engine.rng,
        }) ?? { kind: 'endTurn', actorId: actor.id };
        engine = applyDecision(engine, decision, controller);
    }
    return engine.phase === 'complete' ? engine : complete(engine, 'draw', 'maxRounds');
}

export function legalDecisions(state: CombatState, combatant: Combatant): LegalDecision[] {
    if (!isActive(combatant)) return [{ kind: 'wait', actorId: combatant.id, reason: 'incapacitated' }];
    return ACTION_CATALOGUE.flatMap(entry => entry.legal(state, combatant));
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
        kind: 'move',
        legal: (state, actor) => {
            const capabilities = combatantCapabilities(actor);
            if (actor.budget.moves <= 0 || !capabilities.canMove) return [];
            const walk = actor.movementBudget.walk;
            const run = actor.movementBudget.run;
            let destinations: { mode: MovementMode; target: number | { combatantId: string } }[] = [];
            for (const mode of ['walk', 'run'] as MovementMode[]) {
                for (const i of [...Array(mode === 'walk' ? 2 * walk + 1 : 2 * run + 1).keys()].map(i => -walk + i).filter(i => i !== 0)) {
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
        dispatch: (engine, decision, controller) => {
            const target = decision.target ?? decision.destination;
            if (target === undefined) return { state: engine.state, events: [decisionRejected(decision, 'missingTarget')] };
            let result = applyMove(engine.state, decision.actorId, target, decision.mode ?? 'walk', engine.rng);
            if (decision.mode === 'charge' && controller) {
                const action = decision.action as MeleeAttackAction | undefined;
                result = threadChargeReactions({ ...engine, state: result.state }, decision, result, controller);
                if (!action) return result;

                let prepared = withFateInterceptionChoice({ ...engine, state: result.state, events: [...result.events] }, controller, action.defenderId, action);
                prepared = { ...prepared, events: [...engine.events, ...prepared.events] };
                result = resolveMeleeAttack(prepared.state, prepared.action, engine.rng);
                result = { state: result.state, events: [...prepared.events, ...result.events] };
                result = threadAttackReactions({ ...engine, state: result.state }, decision, result, controller);
                return spendTurnAction(result.state, decision.actorId, result.events);
            }
            return result;
        },
    },
    {
        kind: 'meleeAttack',
        legal: (state, actor) => {
            const actorReach = REACH_ENGAGEMENT_DISTANCE[(state.weapons.filter(weapon => weapon.id === (actor.weaponLoadout?.primaryWeaponId ?? ''))?.[0]?.reach as WeaponReach) ?? "Short"];
            return actionBudgetReady(actor)
            ? enemyIds(state, actor).filter(id => Math.abs(state.combatants[id].position - actor.position) <= actorReach).map(targetId => ({ kind: 'meleeAttack', actorId: actor.id, targetId, targetIds: [targetId] }))
            : []
        },
        dispatch: (engine, decision, controller) => {
            const action = decision.action as MeleeAttackAction | undefined;
            if (!action) return { state: engine.state, events: [decisionRejected(decision, 'missingAction')] };
            const prepared = withFateInterceptionChoice(engine, controller, action.defenderId, action);
            let result = resolveMeleeAttack(prepared.state, prepared.action, engine.rng);
            result = { state: result.state, events: [...prepared.events, ...result.events] };
            result = threadAttackReactions({ ...engine, state: result.state }, decision, result, controller);
            return spendTurnAction(result.state, decision.actorId, result.events);
        },
    },
    {
        kind: 'rangedAttack',
        legal: (state, actor) => {
            if (!actionBudgetReady(actor) || !canUseRangedWeapon(state, actor)) return [];
            const weapon = equippedWeapon(state, actor);
            return enemyIds(state, actor).map(targetId => ({
                kind: 'rangedAttack',
                actorId: actor.id,
                targetId,
                targetIds: [targetId],
                weaponId: weapon?.id,
                weaponIds: weapon ? [weapon.id] : [],
            }));
        },
        dispatch: (engine, decision, controller) => {
            const action = decision.action as RangedAttackAction | undefined;
            if (!action) return { state: engine.state, events: [decisionRejected(decision, 'missingAction')] };
            const prepared = withFateInterceptionChoice(engine, controller, action.defenderId, action);
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
    ...combatActionEntries(['assess', 'defend', 'aim', 'sprint', 'firstAid']),
    ...targetedCombatActionEntries(['infighting', 'disengageDodge', 'grappleInitiate', 'grappleMaintain', 'grappleBreak', 'attackWithBoth', 'beatBlade', 'disarm', 'feint', 'distractOpponent']),
    {
        kind: 'shieldsman',
        legal: (state, actor) => hasTalent(actor, 'shieldsman') && state.advantagePools[actor.side] >= 2
            ? enemyIds(state, actor).map(targetId => ({ kind: 'shieldsman', actorId: actor.id, targetId, targetIds: [targetId], parameterDomains: { shieldsmanMode: ['push', 'damage'] } }))
            : [],
        dispatch: (engine, decision, controller) => {
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
        legal: (_state, actor) => hasTalent(actor, 'reversal')
            ? [{ kind: 'reversal', actorId: actor.id, parameterDomains: { reversalActive: [true, false] } }]
            : [],
        dispatch: (engine, decision, controller) => {
            const active = decision.reversalActive ?? chooseResolution(engine, controller, decision.actorId, 'reversalToggle', [
                { kind: 'reversal', actorId: decision.actorId, reversalActive: true },
                { kind: 'reversal', actorId: decision.actorId, reversalActive: false },
            ], decision)?.reversalActive ?? true;
            return toggleReversal(engine.state, decision.actorId, active, 'always');
        },
    },
];

function combatActionEntries(kinds: CombatActionKind[]): ActionCatalogueEntry[] {
    return kinds.map(kind => ({
        kind: kind as CombatDecisionKind,
        legal: (_state, actor) => actionBudgetReady(actor) ? [{ kind: kind as CombatDecisionKind, actorId: actor.id, request: { kind, actorId: actor.id } }] : [],
        dispatch: (engine, decision) => resolveCombatAction(engine.state, requestForDecision(kind, decision), engine.rng),
    }));
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
        dispatch: (engine, decision, controller) => {
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

function threadDeferredResolutionDecisions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, controller?: CombatantController): CombatEngineResult {
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

function threadAttackReactions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, controller?: CombatantController): CombatEngineResult {
    if (!controller) return result;
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
        const choice = controller.choose({
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

function threadChargeReactions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, controller: CombatantController): CombatEngineResult {
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
    const choice = controller.choose({
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
    controller: CombatantController | undefined,
    defenderId: string,
    action: TAction
): { state: CombatState; action: TAction; events: CombatEvent[] } {
    if (!controller) return { state: engine.state, action, events: [] };
    const defender = engine.state.combatants[defenderId];
    if (!defender || (defender.resources.fate?.current ?? 0) <= 0) return { state: engine.state, action, events: [] };
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

function threadDeathInterceptions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, controller?: CombatantController): CombatEngineResult {
    if (!controller) return result;
    const deaths = result.events.filter((event): event is Extract<CombatEvent, { type: 'CombatantDied' }> => event.type === 'CombatantDied');
    if (deaths.length === 0) return result;

    let state = result.state;
    let events = [...result.events];
    for (const death of deaths) {
        const combatantId = death.data.combatantId;
        const actor = state.combatants[combatantId];
        if (!actor || (actor.resources.fate?.current ?? 0) <= 0) continue;
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
        const { dead: _dead, ...withoutDead } = surviving as Combatant & { dead?: boolean };
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

function threadDamageInterceptions(engine: TurnEngineState, parent: CombatDecision, result: CombatEngineResult, controller?: CombatantController): CombatEngineResult {
    if (!controller) return result;
    if (result.events.some(event => event.type === 'FateInterceptionEvent' && (event as any).data?.intercepted === 'damage')) return result;
    const damageEvents = result.events.filter((event): event is Extract<CombatEvent, { type: 'DamageDealt' }> => event.type === 'DamageDealt' && event.data.damageDealt > 0);
    if (damageEvents.length === 0) return result;

    let state = result.state;
    const events = [...result.events];
    for (const damage of damageEvents) {
        const defenderId = damage.data.defenderId;
        const defender = state.combatants[defenderId];
        if (!defender || (defender.resources.fate?.current ?? 0) <= 0) continue;
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
            ...enemyIds(state, actor).map(targetId => ({ kind: 'spendAdvantage' as const, actorId: actor.id, targetId, targetIds: [targetId], advantageAction: 'batter' as const, reason: 'batter' })),
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

function stepAutomatic(engine: TurnEngineState, options: TurnEngineOptions): TurnEngineState {
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
        const state = resetRoundState({ ...engine.state, round });
        const order = initiativeOrderFor(state, engine.rng);
        return {
            ...engine,
            state,
            round,
            initiativeOrder: order,
            turnIndex: 0,
            phase: order.length === 0 ? 'complete' : 'awaitingDecision',
            activeCombatantId: order[0],
            events: [
                ...engine.events,
                turnEvent('RoundStarted', 'combat.turn.roundStarted', { round }),
                turnEvent('TurnStarted', 'combat.turn.startedActor', { round, combatantId: order[0] }),
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
    const currentState = result.state;
    const nextEngine = { ...engine, state: currentState, events: [...engine.events, ...result.events] };

    const endedId = nextEngine.activeCombatantId!;
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
            currentState = replaceCombatant(currentState, { ...currentState.combatants[combatant.id], dead: true } as Combatant);
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
    return !actor || actor.budget.actions <= 0 && actor.budget.moves <= 0;
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
        events: [ ...engine.events, turnEvent('CombatEnded', 'combat.turn.ended', { outcome, reason })],
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

function isActive(combatant: Combatant | undefined): boolean {
    return !!combatant && combatant.currentWounds > 0 && !combatant.removedFromEncounter && !(combatant as any).dead && !combatant.conditions.includes('condition_unconscious');
}

function controllerFor(controllers: Record<string, CombatantController> | CombatantController, actorId: string): CombatantController | undefined {
    return isController(controllers) ? controllers : controllers[actorId];
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
    return JSON.parse(JSON.stringify(value));
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
