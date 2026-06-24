import { describe, expect, it, vi } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    advanceToNextDecision,
    createCombatState,
    createCombatantFromCharacter,
    createTurnEngine,
    heuristicControllerFor,
    legalDecisions,
    type CombatDecision,
    type ControllerResolver,
} from '../../src/combat';
import { NeedDecision, RemotePlayerController } from '../../src/combat/remote-player-controller';
import { stepWithRemoteControllers } from '../../src/combat/replay-orchestrator';

// ---------------------------------------------------------------------------
// Unit: RemotePlayerController
// ---------------------------------------------------------------------------

describe('RemotePlayerController', () => {
    it('returns cached decision without throwing or calling onRequest', () => {
        const awaitingState = getAwaitingState('cached');
        const actorId = awaitingState.activeCombatantId!;
        const actor = awaitingState.state.combatants[actorId];
        const legal = legalDecisions(awaitingState.state, actor);
        const ctx = { level: 'turn' as const, engine: awaitingState, state: awaitingState.state, actor, legalDecisions: legal, rng: awaitingState.rng };

        // Pre-populate cache with the requestId that would be generated for this context.
        const probe = new RemotePlayerController(new Map(), () => {});
        let probeId = '';
        try { probe.choose(ctx); } catch (e) { probeId = (e as NeedDecision).requestId; }

        const decision: CombatDecision = { kind: 'endTurn', actorId };
        const cache = new Map([[probeId, decision]]);
        const onRequest = vi.fn();

        const result = new RemotePlayerController(cache, onRequest).choose(ctx);

        expect(result).toEqual(decision);
        expect(onRequest).not.toHaveBeenCalled();
    });

    it('throws NeedDecision with correct metadata when decision is not cached', () => {
        const awaitingState = getAwaitingState('uncached');
        const actorId = awaitingState.activeCombatantId!;
        const actor = awaitingState.state.combatants[actorId];
        const legal = legalDecisions(awaitingState.state, actor);
        const ctx = { level: 'turn' as const, engine: awaitingState, state: awaitingState.state, actor, legalDecisions: legal, rng: awaitingState.rng };

        const onRequest = vi.fn();
        const controller = new RemotePlayerController(new Map(), onRequest);

        let thrown: NeedDecision | undefined;
        try { controller.choose(ctx); } catch (e) { thrown = e as NeedDecision; }

        expect(thrown).toBeInstanceOf(NeedDecision);
        expect(thrown!.requestId.length).toBeGreaterThan(0);
        expect(thrown!.request.actorId).toBe(actorId);
        expect(thrown!.request.level).toBe('turn');
        expect(thrown!.request.round).toBe(awaitingState.round);
        expect(onRequest).toHaveBeenCalledOnce();
        expect(onRequest).toHaveBeenCalledWith(thrown!.request);
    });

    it('returns the fed decision on a second (re-run) controller instance', () => {
        const awaitingState = getAwaitingState('feed-rerun');
        const actorId = awaitingState.activeCombatantId!;
        const actor = awaitingState.state.combatants[actorId];
        const legal = legalDecisions(awaitingState.state, actor);
        const ctx = { level: 'turn' as const, engine: awaitingState, state: awaitingState.state, actor, legalDecisions: legal, rng: awaitingState.rng };
        const cache = new Map<string, CombatDecision>();

        let requestId = '';
        try { new RemotePlayerController(cache, () => {}).choose(ctx); } catch (e) { requestId = (e as NeedDecision).requestId; }

        cache.set(requestId, { kind: 'endTurn', actorId });

        // Fresh controller (resets callCounts) with the same cache → cache hit.
        const result = new RemotePlayerController(cache, vi.fn()).choose(ctx);

        expect(result).toEqual({ kind: 'endTurn', actorId });
    });

    it('generates byte-identical requestIds across two independent controller instances', () => {
        const awaitingState = getAwaitingState('stable-ids');
        const actorId = awaitingState.activeCombatantId!;
        const actor = awaitingState.state.combatants[actorId];
        const legal = legalDecisions(awaitingState.state, actor);
        const ctx = { level: 'turn' as const, engine: awaitingState, state: awaitingState.state, actor, legalDecisions: legal, rng: awaitingState.rng };

        const captureId = () => {
            try { new RemotePlayerController(new Map(), () => {}).choose(ctx); } catch (e) { return (e as NeedDecision).requestId; }
            return '';
        };

        const id1 = captureId();
        const id2 = captureId();

        expect(id1.length).toBeGreaterThan(0);
        expect(id1).toBe(id2);
    });
});

// ---------------------------------------------------------------------------
// Integration: stepWithRemoteControllers
// ---------------------------------------------------------------------------

describe('stepWithRemoteControllers', () => {
    it('returns pendingRequest when the active combatant is remote', () => {
        const engine = createTurnEngine(oneVsOne(), { seed: 'step-pending' });
        const awaitingState = advanceToNextDecision(engine);
        const actorId = awaitingState.activeCombatantId!;
        const remoteIds = new Set([actorId]);
        const heuristic: ControllerResolver = () => heuristicControllerFor();
        const cache = new Map<string, CombatDecision>();

        const result = stepWithRemoteControllers(awaitingState, remoteIds, heuristic, cache, () => {});

        expect(result.pendingRequest).toBeDefined();
        expect(result.pendingRequest!.actorId).toBe(actorId);
        expect(result.state.phase).toBe('awaitingDecision');
    });

    it('advances state after feeding the decision into cache', () => {
        const engine = createTurnEngine(oneVsOne(), { seed: 'step-advance' });
        const awaitingState = advanceToNextDecision(engine);
        const actorId = awaitingState.activeCombatantId!;
        const remoteIds = new Set([actorId]);
        const heuristic: ControllerResolver = () => heuristicControllerFor();
        const cache = new Map<string, CombatDecision>();

        const pending = stepWithRemoteControllers(awaitingState, remoteIds, heuristic, cache, () => {});
        expect(pending.pendingRequest).toBeDefined();

        cache.set(pending.pendingRequest!.requestId, { kind: 'endTurn', actorId });

        const result = stepWithRemoteControllers(pending.state, remoteIds, heuristic, cache, () => {});

        expect(result.pendingRequest).toBeUndefined();
    });

    it('produces byte-identical state on two independent replays from the same pre-state', () => {
        const engine = createTurnEngine(oneVsOne(), { seed: 'determinism-check' });
        const awaitingState = advanceToNextDecision(engine);
        const actorId = awaitingState.activeCombatantId!;
        const remoteIds = new Set([actorId]);
        const heuristic: ControllerResolver = () => heuristicControllerFor();
        const decision: CombatDecision = { kind: 'endTurn', actorId };

        const runReplay = () => {
            const cache = new Map<string, CombatDecision>();
            const pending = stepWithRemoteControllers(awaitingState, remoteIds, heuristic, cache, () => {});
            cache.set(pending.pendingRequest!.requestId, decision);
            return {
                requestId: pending.pendingRequest!.requestId,
                result: stepWithRemoteControllers(pending.state, remoteIds, heuristic, cache, () => {}),
            };
        };

        const runA = runReplay();
        const runB = runReplay();

        // requestId must be stable (validates (c) determinism property)
        expect(runA.requestId).toBe(runB.requestId);
        // Engine state must be byte-identical
        expect(JSON.stringify(runA.result.state)).toBe(JSON.stringify(runB.result.state));
    });
});

// ---------------------------------------------------------------------------
// Fixtures (shared with turn-engine.test.ts pattern)
// ---------------------------------------------------------------------------

const sword: Weapon = {
    id: 'sword', name: 'sword', group: 'basic', price: '1 GC', enc: 1,
    reach: 'Average', damage: '+SB+4', qualities: [], availability: 'Common',
};

function getAwaitingState(seed: string) {
    return advanceToNextDecision(createTurnEngine(oneVsOne(), { seed }));
}

function oneVsOne() {
    return createCombatState([
        combatant('ally', 'ally', 0),
        combatant('enemy', 'adversary', 2),
    ], { weapons: [sword] });
}

function combatant(id: string, side: 'ally' | 'adversary', position: number) {
    return createCombatantFromCharacter(characterFixture(id), {
        id,
        side,
        position,
        currentWounds: 12,
        maxWounds: 12,
        conditions: [],
        engagementIds: [],
        weaponLoadout: { primaryWeaponId: 'sword' },
    });
}

function characterFixture(id: string): Character {
    const characteristic = (value: number) => ({ initial: value, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: null,
        tags: [],
        locationId: null,
        xp: { spent: 0, current: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '', partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(50),
            bs: characteristic(50),
            s: characteristic(30),
            t: characteristic(30),
            i: characteristic(30),
            ag: characteristic(50),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 12, max: 12 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: {
            weapons: { sword: 1 },
            armor: {},
            items: {},
            equippedWeapons: { sword: true },
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
