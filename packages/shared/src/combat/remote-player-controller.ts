import type { Combatant, CombatState } from './types';
import type { CombatantController, CombatDecision, DecisionContext, LegalDecision, TurnEngineState } from './turn-engine';

// Minimal serialisable board snapshot sent to the player UI — expanded in LP-c.
export type FightStateView = Pick<CombatState, 'combatants' | 'advantagePools' | 'engagements'> & { round: number };

// Everything the player needs to render the legal-decision palette and the board.
export interface DecisionRequest {
    requestId: string;
    actorId: string;
    characterName: string;
    round: number;
    turnIndex: number;
    level: 'turn' | 'resolution';
    reason?: string;
    legalDecisions: LegalDecision[];
    parentDecision?: CombatDecision;
    stateView: FightStateView;
}

// Thrown by RemotePlayerController when a decision is needed but not yet in cache.
// The orchestrator catches this, emits REQUEST_DECISION, and re-runs from the pre-state
// once the response arrives.
export class NeedDecision {
    constructor(
        public readonly requestId: string,
        public readonly context: DecisionContext,
        public readonly request: DecisionRequest,
    ) {}
}

function stableKey(context: DecisionContext): string {
    return `${context.actor.id}:r${context.engine.round}:t${context.engine.turnIndex}:${context.level}:${context.reason ?? ''}`;
}

function buildStateView(state: CombatState, round: number): FightStateView {
    return {
        combatants: state.combatants,
        advantagePools: state.advantagePools,
        engagements: state.engagements,
        round,
    };
}

function buildRequest(requestId: string, context: DecisionContext): DecisionRequest {
    const actor = context.actor as Combatant & { name: string };
    return {
        requestId,
        actorId: context.actor.id,
        characterName: actor.name,
        round: context.engine.round,
        turnIndex: context.engine.turnIndex,
        level: context.level,
        reason: context.reason,
        legalDecisions: context.legalDecisions,
        parentDecision: context.parentDecision,
        stateView: buildStateView(context.state, context.engine.round),
    };
}

// Implements CombatantController for a human player over a socket.
//
// RequestId stability: callCounts resets to 0 on construction. Since applyDecision is
// deterministic, choose() is called in identical order on every re-run from the same
// pre-state, producing the same stableKey sequence and therefore the same requestIds.
// The cache (shared across re-runs) is keyed by those stable requestIds.
export class RemotePlayerController implements CombatantController {
    private readonly callCounts = new Map<string, number>();

    constructor(
        private readonly cache: Map<string, CombatDecision>,
        private readonly onRequest: (req: DecisionRequest) => void,
    ) {}

    choose(context: DecisionContext): CombatDecision | undefined {
        const key = stableKey(context);
        const count = this.callCounts.get(key) ?? 0;
        this.callCounts.set(key, count + 1);
        const requestId = `${key}:${count}`;

        if (this.cache.has(requestId)) return this.cache.get(requestId)!;

        const request = buildRequest(requestId, context);
        this.onRequest(request);
        throw new NeedDecision(requestId, context, request);
    }
}

