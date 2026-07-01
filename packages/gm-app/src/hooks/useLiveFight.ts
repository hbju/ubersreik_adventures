import { useCallback, useRef, useState } from 'react';
import {
    createCombatState,
    createCombatantFromCharacter,
    createTurnEngine,
    gatherPsychologyRequests,
    heuristicControllerFor,
    stepWithRemoteControllers,
    type CombatDecision,
    type CombatState,
    type ControllerResolver,
    type DecisionRequest,
    type FightStateView,
    type TurnEngineState,
} from '@wfrp/shared';
import type { Character, Weapon } from '@wfrp/shared';

// ---------------------------------------------------------------------------
// Dev fixture — one allied PC with Fortune (to exercise psychology fan-out)
// facing a Terror-1 adversary.  LP-d will replace this with real encounter seeding.
// ---------------------------------------------------------------------------

const DEV_SWORD: Weapon = {
    id: 'sword', name: 'Sword', group: 'basic', price: '5 GC', enc: 1,
    reach: 'Average', damage: '+SB+4', qualities: [], availability: 'Common',
};

function devCharacter(id: string, fortune = 2): Character {
    const stat = (v: number) => ({ initial: v, advances: 0, talents: 0, modifier: 0 });
    return {
        id, name: id === 'ernst' ? 'Ernst Steurmann' : 'Skeleton',
        species: 'Human', class: 'Warrior',
        currentCareerId: '', currentCareerLevelId: '',
        userId: id === 'ernst' ? null : null,
        tags: [], locationId: null,
        xp: { spent: 0, current: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [], unlockedSkillIds: [], unlockedTalentIds: [],
        details: { age: '', height: '', hair: '', eyes: '', partyName: '', shortTermAmbition: '', longTermAmbition: '', partyShortTermAmbition: '', partyLongTermAmbition: '' },
        movement: 4,
        characteristics: {
            ws: stat(35), bs: stat(30), s: stat(30), t: stat(30),
            i: stat(30), ag: stat(30), dex: stat(30), int: stat(30),
            wp: stat(25), fel: stat(25),
        },
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'cool', name: 'Cool', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 12, max: 12 },
            fate: { current: 0, max: 0 },
            fortune: { current: fortune, max: fortune },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: {
            weapons: { sword: 1 }, armor: {}, items: {},
            equippedWeapons: { sword: true }, equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

export const DEV_FIGHT_FIXTURE = {
    combatState: createCombatState([
        createCombatantFromCharacter(devCharacter('ernst', 2), {
            id: 'ernst', side: 'ally', position: 0,
            currentWounds: 12, maxWounds: 12, conditions: [], engagementIds: [],
            weaponLoadout: { primaryWeaponId: 'sword' },
        }),
        createCombatantFromCharacter(devCharacter('skeleton-1', 0), {
            id: 'skeleton-1', side: 'adversary', position: 2,
            currentWounds: 10, maxWounds: 10, conditions: [], engagementIds: [],
            weaponLoadout: { primaryWeaponId: 'sword' },
            causesTerror: { rating: 1 },
        }),
    ], { weapons: [DEV_SWORD] }),
    // actorId 'ernst' is treated as a remote player; 'skeleton-1' runs heuristic AI
    remoteActorIds: new Set(['ernst']),
    seed: 'lp-b-dev',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface LiveFightHook {
    liveFightEngine: TurnEngineState | null;
    /** Psychology fan-out requests — all sent simultaneously, all must be answered */
    pendingPsychRequests: DecisionRequest[];
    /** Current main-turn decision request (null when not awaiting) */
    pendingMainRequest: DecisionRequest | null;
    startFight: (combatState: CombatState, remoteActorIds: Set<string>, seed?: string) => void;
    handleDecisionResponse: (requestId: string, decision: CombatDecision) => void;
    handlePlayerReconnect: (userId: string) => void;
    stopFight: () => void;
}

interface UseLiveFightOptions {
    /** Characters from campaign state — used to map actorId → userId for sendToPlayer */
    characters: Character[];
}

export function useLiveFight({ characters }: UseLiveFightOptions): LiveFightHook {
    const [liveFightEngine, setLiveFightEngine] = useState<TurnEngineState | null>(null);
    const [pendingPsychRequests, setPendingPsychRequests] = useState<DecisionRequest[]>([]);
    const [pendingMainRequest, setPendingMainRequest] = useState<DecisionRequest | null>(null);

    // Refs hold authoritative mutable state accessed from closures without stale-capture
    const engineRef = useRef<TurnEngineState | null>(null);
    const decisionCacheRef = useRef<Map<string, CombatDecision>>(new Map());
    const remoteActorIdsRef = useRef<Set<string>>(new Set());
    const pendingPsychCountdownRef = useRef<Set<string>>(new Set());
    const pendingMainRequestIdRef = useRef<string | null>(null);
    // Tracks last REQUEST_DECISION sent per actorId so it can be re-sent on reconnect
    const lastSentRequestsRef = useRef<Map<string, DecisionRequest>>(new Map());

    // Map character id → userId for routing REQUEST_DECISION to the right player socket
    const characterIdToUserId = useCallback((characterId: string): string | null => {
        const char = characters.find(c => c.id === characterId);
        return char?.userId ?? null;
    }, [characters]);

    // Reverse map: userId → character id
    const userIdToCharacterId = useCallback((userId: string): string | null => {
        const char = characters.find(c => c.userId === userId);
        return char?.id ?? null;
    }, [characters]);

    const sendDecisionRequest = useCallback((req: DecisionRequest) => {
        const userId = characterIdToUserId(req.characterId);
        if (!userId) {
            console.warn(`[LiveFight] No userId for characterId ${req.characterId} — cannot send REQUEST_DECISION`);
            return;
        }
        window.ipcRenderer.sendToPlayer(userId, { type: 'REQUEST_DECISION', payload: req });
        lastSentRequestsRef.current.set(req.actorId, req);
    }, [characterIdToUserId]);

    const heuristicResolver: ControllerResolver = useCallback(
        () => heuristicControllerFor(),
        [],
    );

    const broadcastFightState = useCallback((engine: TurnEngineState | null) => {
        if (!engine) {
            window.ipcRenderer.sendToAllPlayers({ type: 'FIGHT_STATE_UPDATE', payload: null });
            return;
        }
        const stateView: FightStateView = {
            combatants: engine.state.combatants,
            advantagePools: engine.state.advantagePools,
            engagements: engine.state.engagements,
            round: engine.round,
        };
        window.ipcRenderer.sendToAllPlayers({
            type: 'FIGHT_STATE_UPDATE',
            payload: {
                stateView,
                activeCombatantId: engine.activeCombatantId ?? null,
                phase: engine.phase,
            },
        });
    }, []);

    const step = useCallback((i: number) => { 
        const engine = engineRef.current;
        if (!engine || engine.phase === 'complete') return;

        const remoteIds = remoteActorIdsRef.current;
        const cache = decisionCacheRef.current;

        // 1. Probe for round-start psychology Fortune-reroll opportunities
        const psychRequests = gatherPsychologyRequests(engine, remoteIds, heuristicResolver, cache)
            .filter(req => !cache.has(req.requestId));

        if (psychRequests.length > 0) {
            // Fan out all psychology requests simultaneously
            for (const req of psychRequests) {
                pendingPsychCountdownRef.current.add(req.requestId);
                sendDecisionRequest(req);
            }
            setPendingPsychRequests(psychRequests);
            return; // wait for all responses
        }

        // 2. Main turn step
        const result = stepWithRemoteControllers(engine, remoteIds, heuristicResolver, cache, sendDecisionRequest);

        if (result.pendingRequest) {
            pendingMainRequestIdRef.current = result.pendingRequest.requestId;
            setPendingMainRequest(result.pendingRequest);
            return;
        }

        // 3. Step completed — advance state
        engineRef.current = result.state;
        setLiveFightEngine(result.state);
        setPendingMainRequest(null);
        decisionCacheRef.current = new Map(); // clear cache for next turn
        broadcastFightState(result.state);

        if (result.state.phase !== 'complete' && i < 1000) {
            // Loop for NPC-only turns (heuristic fires immediately, no suspension)
            step(i + 1);
        }
    }, [heuristicResolver, sendDecisionRequest, broadcastFightState]);

    const startFight = useCallback((combatState: CombatState, remoteActorIds: Set<string>, seed = 'lp-b') => {
        const engine = createTurnEngine(combatState, { seed });
        engineRef.current = engine;
        decisionCacheRef.current = new Map();
        remoteActorIdsRef.current = remoteActorIds;
        pendingPsychCountdownRef.current = new Set();
        pendingMainRequestIdRef.current = null;

        setLiveFightEngine(engine);
        setPendingPsychRequests([]);
        setPendingMainRequest(null);
        broadcastFightState(engine);

        step(0);
    }, [step, broadcastFightState]);

    const handleDecisionResponse = useCallback((requestId: string, decision: CombatDecision) => {
        decisionCacheRef.current.set(requestId, decision);

        // Is it a psychology response?
        if (pendingPsychCountdownRef.current.has(requestId)) {
            pendingPsychCountdownRef.current.delete(requestId);
            setPendingPsychRequests(prev => {
                const fulfilled = prev.find(r => r.requestId === requestId);
                if (fulfilled) lastSentRequestsRef.current.delete(fulfilled.actorId);
                return prev.filter(r => r.requestId !== requestId);
            });

            if (pendingPsychCountdownRef.current.size === 0) {
                // All psychology responses received — proceed to main step
                step(0);
            }
            return;
        }

        // Main-turn response
        if (requestId === pendingMainRequestIdRef.current) {
            const activeRequest = Array.from(lastSentRequestsRef.current.values())
                .find(r => r.requestId === requestId);
            if (activeRequest) lastSentRequestsRef.current.delete(activeRequest.actorId);
            pendingMainRequestIdRef.current = null;
            setPendingMainRequest(null);
            step(0);
        }
    }, [step]);

    const handlePlayerReconnect = useCallback((userId: string) => {
        const engine = engineRef.current;
        if (!engine) return;
        broadcastFightState(engine);
        const characterId = userIdToCharacterId(userId);
        if (!characterId) return;
        const pendingReq = lastSentRequestsRef.current.get(characterId);
        if (pendingReq && !decisionCacheRef.current.has(pendingReq.requestId)) {
            window.ipcRenderer.sendToPlayer(userId, { type: 'REQUEST_DECISION', payload: pendingReq });
        }
    }, [broadcastFightState, userIdToCharacterId]);

    const stopFight = useCallback(() => {
        engineRef.current = null;
        decisionCacheRef.current = new Map();
        remoteActorIdsRef.current = new Set();
        pendingPsychCountdownRef.current = new Set();
        pendingMainRequestIdRef.current = null;
        lastSentRequestsRef.current = new Map();

        setLiveFightEngine(null);
        setPendingPsychRequests([]);
        setPendingMainRequest(null);
        broadcastFightState(null);
    }, [broadcastFightState]);

    return { liveFightEngine, pendingPsychRequests, pendingMainRequest, startFight, handleDecisionResponse, handlePlayerReconnect, stopFight };
}
