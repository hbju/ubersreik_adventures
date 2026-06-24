import { advanceToNextDecision, applyDecision, legalDecisions, type CombatDecision, type CombatantController, type ControllerResolver, type TurnEngineState } from './turn-engine';
import { DecisionRequest, NeedDecision, RemotePlayerController } from './remote-player-controller';

export interface ReplayStepResult {
    // On success: the advanced engine state (phase may be awaitingDecision or complete).
    // On suspension: the awaiting-decision state that was the re-run origin — pass it
    // back unchanged on the next call after feeding the response into decisionCache.
    state: TurnEngineState;
    pendingRequest?: DecisionRequest;
}

// Advance the engine by one decision step, handling remote human players via replay-to-resume.
//
// Usage pattern :
//   1. Call stepWithRemoteControllers(engine, remoteActorIds, heuristicResolver, cache, onRequest)
//   2. If result.pendingRequest is set: send REQUEST_DECISION to the player; when
//      DECISION_RESPONSE arrives, do cache.set(pendingRequest.requestId, decision) and
//      re-call with the same result.state and same cache.
//   3. Repeat until result.pendingRequest is undefined → decision committed; advance to next step.
//
// The function calls advanceToNextDecision internally, so callers may pass any phase.
export function stepWithRemoteControllers(
    engine: TurnEngineState,
    remoteActorIds: ReadonlySet<string>,
    heuristicResolver: ControllerResolver,
    decisionCache: Map<string, CombatDecision>,
    onRequest: (req: DecisionRequest) => void,
): ReplayStepResult {
    const awaitingState = advanceToNextDecision(engine);
    if (awaitingState.phase === 'complete') return { state: awaitingState };

    const actorId = awaitingState.activeCombatantId;
    if (!actorId) return { state: awaitingState };

    // Create a fresh RemotePlayerController (resets callCounts) sharing the same cache.
    // On re-runs from awaitingState, choose() is called in identical order → same requestIds → same cache hits.
    const remoteController = new RemotePlayerController(decisionCache, onRequest);

    const fullResolver: ControllerResolver = (id) =>
        remoteActorIds.has(id)
            ? (remoteController as CombatantController)
            : heuristicResolver(id);

    try {
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
        if (e instanceof NeedDecision) {
            return { state: awaitingState, pendingRequest: e.request };
        }
        throw e;
    }
}
