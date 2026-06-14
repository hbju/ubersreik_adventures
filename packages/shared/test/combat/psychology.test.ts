import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/types/wfrp.types';
import {
    applyMove,
    applyDecision,
    advanceToNextDecision,
    createCombatState,
    createCombatantFromCharacter,
    createTurnEngine,
    createSeededRng,
    fearPreRollModifiers,
    isActivelyAfraidOf,
    resolveMeleeAttack,
    resolvePsychologyExposure,
    resolvePsychologyRoundStart,
    HeuristicController,
    type CombatState,
    type Rng,
} from '../../src/combat';

describe('PSY-a Fear and Terror', () => {
    it('exposes Frightening and Terrifying ratings from talent ranks', () => {
        const frightening = combatant('frightening', 'adversary', { frightening: 3 });
        const terrifying = combatant('terrifying', 'adversary', { terrifying: 2 });

        expect(frightening.causesFear).toEqual({ rating: 3 });
        expect(terrifying.causesTerror).toEqual({ rating: 2 });
    });

    it('accumulates Extended Cool Test SL across rounds and grants source immunity', () => {
        let state = fearState(3);
        state = resolvePsychologyRoundStart(state, sequenceRng(31)).state;

        expect(state.combatants.target.psychology?.fears.source).toMatchObject({
            accumulatedSL: 1,
            rating: 3,
            status: 'active',
        });

        state = { ...state, round: 2 };
        const completed = resolvePsychologyRoundStart(state, sequenceRng(21));

        expect(completed.state.combatants.target.psychology?.fears.source).toMatchObject({
            accumulatedSL: 3,
            status: 'immune',
        });
        expect(isActivelyAfraidOf(completed.state.combatants.target, 'source')).toBe(false);
    });

    it('applies -1 SL through pre-roll modifiers against the feared source', () => {
        const state = activeFearState();
        const target = state.combatants.target;
        const source = state.combatants.source;

        expect(fearPreRollModifiers({
            state,
            action: {
                attackerId: target.id,
                defenderId: source.id,
                attacker: { skillId: 'melee_basic', targetNumber: 40 },
                defender: { skillId: 'melee_basic', targetNumber: 40 },
            },
            attacker: target,
            defender: source,
        })).toMatchObject([{ type: 'psychology', value: -10 }]);

        const attack = resolveMeleeAttack(state, {
            attackerId: target.id,
            defenderId: source.id,
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 31 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 91 },
        });
        const resolved = attack.events.find(event => event.type === 'AttackResolved');
        expect(resolved?.data.attackerRoll.targetNumber).toBe(30);
    });

    it('blocks a failed voluntary approach test and permits a passed one', () => {
        const state = activeFearState();
        const failed = applyMove(state, 'target', 4, 'walk', sequenceRng(91));
        const passed = applyMove(state, 'target', 4, 'walk', sequenceRng(11));

        expect(failed.state.combatants.target.position).toBe(0);
        expect(failed.events).toContainEqual(expect.objectContaining({
            type: 'MoveRejectedEvent',
            data: expect.objectContaining({ reason: 'fearApproach' }),
        }));
        expect(passed.state.combatants.target.position).toBe(4);
    });

    it('applies Broken when a Fear source approaches and the Cool Test fails', () => {
        const state = activeFearState();
        const result = applyMove(state, 'source', 6, 'walk', sequenceRng(91));

        expect(result.state.combatants.target.conditions).toContain('condition_broken');
        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'PsychologyTestResolved',
            data: expect.objectContaining({
                psychology: 'sourceApproach',
                brokenApplied: 1,
            }),
        }));
    });

    it('resolves Terror once, applies rating plus failed SL as Broken, then starts Fear', () => {
        const target = combatant('target', 'ally');
        const source = {
            ...combatant('source', 'adversary'),
            causesTerror: { rating: 3 },
        };
        const state = createCombatState([target, source], { round: 1 });
        const result = resolvePsychologyExposure(state, 'target', 'source', sequenceRng(31));

        expect(result.state.combatants.target.conditions.filter(id => id === 'condition_broken')).toHaveLength(5);
        expect(result.state.combatants.target.psychology?.terrors.source).toMatchObject({
            tested: true,
            successLevel: -2,
            brokenApplied: 5,
        });
        expect(result.state.combatants.target.psychology?.fears.source).toMatchObject({
            rating: 3,
            status: 'active',
            downgradedFromTerror: true,
        });

        const repeated = resolvePsychologyExposure(result.state, 'target', 'source', sequenceRng(100));
        expect(repeated.events).toEqual([]);
        expect(repeated.state.combatants.target.conditions.filter(id => id === 'condition_broken')).toHaveLength(5);
    });

    it('causes no immediate effect on a passed Terror Test but still transitions to Fear', () => {
        const target = combatant('target', 'ally', {}, 80);
        const source = { ...combatant('source', 'adversary'), causesTerror: { rating: 1 } };
        const result = resolvePsychologyExposure(
            createCombatState([target, source], { round: 1 }),
            'target',
            'source',
            sequenceRng(11)
        );

        expect(result.state.combatants.target.conditions).not.toContain('condition_broken');
        expect(result.state.combatants.target.psychology?.terrors.source?.successLevel).toBeGreaterThanOrEqual(0);
        expect(isActivelyAfraidOf(result.state.combatants.target, 'source')).toBe(true);
    });

    it('makes Fearless immune to Fear and downgrades Terror to the Fear track', () => {
        const fearless = combatant('target', 'ally', { fearless: 1 });
        const fearSource = { ...combatant('fear', 'adversary'), causesFear: { rating: 2 } };
        const terrorSource = { ...combatant('terror', 'adversary'), causesTerror: { rating: 3 } };
        let state = createCombatState([fearless, fearSource, terrorSource], { round: 1 });

        state = resolvePsychologyExposure(state, 'target', 'fear', sequenceRng(100)).state;
        state = resolvePsychologyExposure(state, 'target', 'terror', sequenceRng(100)).state;

        expect(state.combatants.target.psychology?.fears.fear?.status).toBe('immune');
        expect(state.combatants.target.psychology?.terrors.terror).toMatchObject({ tested: true });
        expect(state.combatants.target.psychology?.fears.terror).toMatchObject({
            status: 'active',
            downgradedFromTerror: true,
        });
        expect(state.combatants.target.conditions).not.toContain('condition_broken');
    });

    it('tracks multiple Fear sources independently', () => {
        const target = combatant('target', 'ally');
        const first = { ...combatant('first', 'adversary'), causesFear: { rating: 1 } };
        const second = { ...combatant('second', 'adversary'), causesFear: { rating: 3 } };
        const result = resolvePsychologyRoundStart(
            createCombatState([target, first, second], { round: 1 }),
            sequenceRng(31, 61)
        );

        expect(Object.keys(result.state.combatants.target.psychology?.fears ?? {})).toEqual(['first', 'second']);
        expect(result.state.combatants.target.psychology?.fears.first?.status).toBe('immune');
        expect(result.state.combatants.target.psychology?.fears.second?.status).toBe('active');
    });

    it('detects a newly inserted source before the next mid-round decision', () => {
        const target = combatant('target', 'ally');
        let engine = advanceToNextDecision(createTurnEngine(
            createCombatState([target]),
            { seed: 'mid-round-source' }
        ));
        const source = { ...combatant('source', 'adversary'), causesFear: { rating: 2 } };
        engine = {
            ...engine,
            state: {
                ...engine.state,
                combatants: { ...engine.state.combatants, source },
            },
        };

        engine = applyDecision(engine, { kind: 'endTurn', actorId: 'target' });

        expect(engine.state.combatants.target.psychology?.fears.source).toMatchObject({
            rating: 2,
            status: 'active',
        });
        expect(engine.events).toContainEqual(expect.objectContaining({
            type: 'PsychologyExposure',
            data: expect.objectContaining({ combatantId: 'target', sourceId: 'source' }),
        }));
    });

    it('is deterministic under a seeded RNG', () => {
        const first = resolvePsychologyRoundStart(fearState(4), createSeededRng('psy-a'));
        const second = resolvePsychologyRoundStart(fearState(4), createSeededRng('psy-a'));

        expect(first).toEqual(second);
    });

    it('makes the heuristic prefer movement away from an active Fear source', () => {
        const state = activeFearState();
        const actor = state.combatants.target;
        const controller = new HeuristicController();
        const decision = controller.choose({
            level: 'turn',
            engine: createTurnEngine(state, { seed: 'fear-ai' }),
            state,
            actor,
            rng: createSeededRng('fear-ai'),
            legalDecisions: [
                { kind: 'move', actorId: actor.id, mode: 'walk', target: 4 },
                { kind: 'move', actorId: actor.id, mode: 'walk', target: -4 },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });

        expect(decision).toMatchObject({ kind: 'move', target: -4 });
    });

    it('makes the heuristic retreat instead of attacking while Broken', () => {
        const state = activeFearState();
        const actor = {
            ...state.combatants.target,
            conditions: ['condition_broken'],
        };
        const brokenState = {
            ...state,
            combatants: { ...state.combatants, target: actor },
        };
        const controller = new HeuristicController();
        const decision = controller.choose({
            level: 'turn',
            engine: createTurnEngine(brokenState, { seed: 'broken-ai' }),
            state: brokenState,
            actor,
            rng: createSeededRng('broken-ai'),
            legalDecisions: [
                { kind: 'meleeAttack', actorId: actor.id, targetId: 'source' },
                { kind: 'move', actorId: actor.id, mode: 'run', target: -8 },
                { kind: 'endTurn', actorId: actor.id },
            ],
        });

        expect(decision).toMatchObject({ kind: 'move', target: -8 });
    });
});

function fearState(rating: number): CombatState {
    return createCombatState([
        combatant('target', 'ally'),
        { ...combatant('source', 'adversary'), causesFear: { rating } },
    ], { round: 1 });
}

function activeFearState(): CombatState {
    const state = fearState(3);
    return {
        ...state,
        combatants: {
            ...state.combatants,
            target: {
                ...state.combatants.target,
                position: 0,
                psychology: {
                    fears: {
                        source: {
                            sourceId: 'source',
                            rating: 3,
                            accumulatedSL: 0,
                            status: 'active',
                        },
                    },
                    terrors: {},
                },
            },
            source: { ...state.combatants.source, position: 10 },
        },
    };
}

function sequenceRng(...rolls: number[]): Rng {
    let index = 0;
    return {
        next: () => {
            const roll = rolls[Math.min(index++, rolls.length - 1)] ?? 50;
            return (roll - 1) / 100;
        },
    };
}

function combatant(
    id: string,
    side: 'ally' | 'adversary',
    talents: Record<string, number> = {},
    willpower = 40
) {
    return createCombatantFromCharacter(character(id, talents, willpower), {
        id,
        side,
        position: side === 'ally' ? 0 : 10,
    });
}

function character(id: string, talents: Record<string, number>, willpower: number): Character {
    const characteristic = (initial: number) => ({ initial, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: id === 'target' ? 'player' : null,
        tags: [],
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '',
            partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(40), bs: characteristic(30), s: characteristic(30),
            t: characteristic(30), i: characteristic(30), ag: characteristic(30),
            dex: characteristic(30), int: characteristic(30), wp: characteristic(willpower),
            fel: characteristic(30),
        },
        skills: [
            { id: 'cool', name: 'Cool', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 10, max: 10 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents,
        inventory: {
            weapons: {},
            armor: {},
            items: {},
            equippedWeapons: {},
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
