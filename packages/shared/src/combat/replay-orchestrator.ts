import { advanceToNextDecision, applyDecision, cloneTurnEngine, legalDecisions, type CombatDecision, type CombatantController, type ControllerResolver, type TurnEngineState } from './turn-engine';
import { DecisionRequest, NeedDecision, PsychologyProbeController, RemotePlayerController } from './remote-player-controller';

export interface ReplayStepResult {
    // On success: the advanced engine state (phase may be awaitingDecision or complete).
    // On suspension: the pre-advance state — pass it back unchanged on the next call
    // after feeding the response into decisionCache.
    state: TurnEngineState;
    pendingRequest?: DecisionRequest;
}

// Advance the engine by one decision step, handling remote human players via replay-to-resume.
//
// Usage pattern:
//   1. Call stepWithRemoteControllers(engine, remoteActorIds, heuristicResolver, cache, onRequest)
//   2. If result.pendingRequest is set: send REQUEST_DECISION to the player; when
//      DECISION_RESPONSE arrives, do cache.set(pendingRequest.requestId, decision) and
//      re-call with the same result.state and same cache.
//   3. Repeat until result.pendingRequest is undefined → decision committed; advance to next step.
//
// The resolver is now threaded through advanceToNextDecision so psychology Fortune-rerolls
// can surface as NeedDecision throws during the automatic roundStart phase.
export function stepWithRemoteControllers(
    engine: TurnEngineState,
    remoteActorIds: ReadonlySet<string>,
    heuristicResolver: ControllerResolver,
    decisionCache: Map<string, CombatDecision>,
    onRequest: (req: DecisionRequest) => void,
): ReplayStepResult {
    const remoteController = new RemotePlayerController(decisionCache, onRequest);
    const fullResolver: ControllerResolver = (id) =>
        remoteActorIds.has(id)
            ? (remoteController as CombatantController)
            : heuristicResolver(id);

    try {
        const awaitingState = advanceToNextDecision(engine, {}, fullResolver);
        if (awaitingState.phase === 'complete') return { state: awaitingState };

        const actorId = awaitingState.activeCombatantId;
        if (!actorId) return { state: awaitingState };

        const actor = awaitingState.state.combatants[actorId];
        const controller = fullResolver(actorId);
        const mainDecision: CombatDecision = controller?.choose({
            level: 'turn',
            engine: awaitingState,
            state: awaitingState.state,
            actor,
            legalDecisions: legalDecisions(awaitingState.state, actor),
            rng: awaitingState.rng,
        }) ?? { kind: 'endTurn', actorId };

        const nextEngine = applyDecision(awaitingState, mainDecision, fullResolver);
        return { state: nextEngine };
    } catch (e) {
        if (e instanceof NeedDecision) return { state: engine, pendingRequest: e.request };
        throw e;
    }
}

// Probe the engine's automatic phases to discover all round-start psychology Fortune-reroll
// opportunities for remote players, WITHOUT blocking on any of them.
//
// The probe runs advanceToNextDecision with a PsychologyProbeController that:
//   - Records each psychology:fortune NeedDecision request and returns 'wait' (sentinel)
//   - Throws NeedDecision for any non-psychology decision (which stops the probe)
//
// Returns all discovered DecisionRequests. The caller emits them all simultaneously as
// REQUEST_DECISION messages, then waits for all responses before calling stepWithRemoteControllers.
//
// The real decisionCache is NOT modified — the probe uses a private copy.
export function gatherPsychologyRequests(
    engine: TurnEngineState,
    remoteActorIds: ReadonlySet<string>,
    heuristicResolver: ControllerResolver,
    knownDecisions: Map<string, CombatDecision>,
): DecisionRequest[] {
    const probeCache = new Map(knownDecisions);
    const probeCtrl = new PsychologyProbeController(probeCache);
    const fullResolver: ControllerResolver = (id) =>
        remoteActorIds.has(id) ? (probeCtrl as CombatantController) : heuristicResolver(id);

    // Clone the engine so the probe doesn't advance the real RNG or share mutable state.
    const probeEngine = cloneTurnEngine(engine);
    try {
        advanceToNextDecision(probeEngine, {}, fullResolver);
    } catch (e) {
        if (!(e instanceof NeedDecision)) throw e;
        // NeedDecision from a non-psychology choice = probe is done
    }

    return probeCtrl.discovered;
}
