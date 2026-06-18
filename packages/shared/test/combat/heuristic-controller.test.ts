import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    applyDecision,
    createCombatantFromCharacter,
    createCombatState,
    createSeededRng,
    createTurnEngine,
    HeuristicController,
    heuristicProfiles,
    runCombatToCompletion,
    type CombatDecision,
} from '../../src/combat';

const sword = weapon('sword', 'basic', '+SB+4', []);
const rapier = weapon('rapier', 'fencing', '+SB+4', ['Fast']);
const bow = weapon('bow', 'bow', '+8', []);

describe('heuristic controller 5c', () => {
    it('loads the five behavior profiles as documented data', () => {
        expect(Object.keys(heuristicProfiles).sort()).toEqual(['berserker', 'brute', 'duellist', 'marksman', 'skirmisher']);
        expect(heuristicProfiles.berserker.intent).toContain('Closes');
        expect(heuristicProfiles.marksman.rangePreference).toBeGreaterThan(heuristicProfiles.berserker.rangePreference);
    });

    it('Berserker charges when a charge is legal', () => {
        const state = createCombatState([
            combatant('berserker', 'ally', ['sword'], 0),
            combatant('enemy', 'adversary', ['sword'], 6),
        ], { weapons: [sword] });
        const controller = new HeuristicController({ profile: 'berserker' });
        const engine = preparedEngine(state, 'berserker');
        const decision = controller.choose({
            level: 'turn',
            engine,
            state,
            actor: state.combatants.berserker,
            legalDecisions: [
                { kind: 'move', actorId: 'berserker', mode: 'charge', target: { combatantId: 'enemy' } },
                { kind: 'endTurn', actorId: 'berserker' },
            ],
            rng: createSeededRng('berserker-choice'),
        });

        expect(decision).toMatchObject({ kind: 'move', mode: 'charge' });
        expect(decision?.decisionLog?.reasonCode).toBe('profile.charge');
    });

    it('Skirmisher disengages when pinned', () => {
        const state = createCombatState([
            combatant('skirmisher', 'ally', ['sword'], 0, { engagementIds: ['enemy'] }),
            combatant('enemy', 'adversary', ['sword'], 0, { engagementIds: ['skirmisher'] }),
        ], { weapons: [sword] });
        const controller = new HeuristicController({ profile: 'skirmisher' });
        const engine = preparedEngine(state, 'skirmisher');
        const decision = controller.choose({
            level: 'turn',
            engine,
            state,
            actor: state.combatants.skirmisher,
            legalDecisions: [
                { kind: 'disengageDodge', actorId: 'skirmisher', targetId: 'enemy', request: { kind: 'disengageDodge', actorId: 'skirmisher', targetId: 'enemy' } },
                { kind: 'meleeAttack', actorId: 'skirmisher', targetId: 'enemy' },
            ],
            rng: createSeededRng('skirmisher-choice'),
        });

        expect(decision).toMatchObject({ kind: 'disengageDodge' });
        expect(decision?.decisionLog?.reasonCode).toBe('profile.disengage');
    });

    it('Marksman shoots at range and materializes a ranged action', () => {
        const state = createCombatState([
            combatant('marksman', 'ally', ['bow'], 0),
            combatant('enemy', 'adversary', ['sword'], 12),
        ], { weapons: [bow, sword] });
        const controller = new HeuristicController({ profile: 'marksman' });
        const engine = preparedEngine(state, 'marksman');
        const decision = controller.choose({
            level: 'turn',
            engine,
            state,
            actor: state.combatants.marksman,
            legalDecisions: [
                { kind: 'rangedAttack', actorId: 'marksman', targetId: 'enemy' },
                { kind: 'move', actorId: 'marksman', mode: 'charge', target: { combatantId: 'enemy' } },
            ],
            rng: createSeededRng('marksman-choice'),
        });

        expect(decision).toMatchObject({ kind: 'rangedAttack', targetId: 'enemy' });
        expect((decision?.action as any)?.attacker.skillId).toBe('ranged_bow');
        expect(decision?.decisionLog?.reasonCode).toBe('action.rangedBestTarget');
    });

    it('Duellist defends when pressed and ripostes at the reaction window', () => {
        const state = createCombatState([
            combatant('duellist', 'ally', ['rapier'], 0, { wounds: 4, maxWounds: 12, talents: { riposte: 1 } }),
            combatant('enemy', 'adversary', ['sword'], 0),
        ], { weapons: [rapier, sword] });
        const controller = new HeuristicController({ profile: 'duellist' });
        const engine = preparedEngine(state, 'duellist');
        const turn = controller.choose({
            level: 'turn',
            engine,
            state,
            actor: state.combatants.duellist,
            legalDecisions: [
                { kind: 'defend', actorId: 'duellist', request: { kind: 'defend', actorId: 'duellist' } },
                { kind: 'meleeAttack', actorId: 'duellist', targetId: 'enemy' },
            ],
            rng: createSeededRng('duellist-turn'),
        });
        const reaction = controller.choose({
            level: 'resolution',
            reason: 'reaction:won-defensive-Melee',
            engine,
            state,
            actor: state.combatants.duellist,
            legalDecisions: [
                { kind: 'reaction', actorId: 'duellist', targetId: 'enemy', trigger: 'won-defensive-Melee', reaction: 'riposte' } as any,
            ],
            rng: createSeededRng('duellist-reaction'),
        });

        expect(turn?.kind).toBe('defend');
        expect(reaction).toMatchObject({ kind: 'reaction', reaction: 'riposte' });
    });

    it('competence floor avoids wasting useful turns and Fate-saves death', () => {
        for (const profile of Object.keys(heuristicProfiles) as Array<keyof typeof heuristicProfiles>) {
            const state = createCombatState([
                combatant('actor', 'ally', ['sword'], 0, { fate: 1 }),
                combatant('enemy', 'adversary', ['sword'], 0),
            ], { weapons: [sword] });
            const controller = new HeuristicController({ profile });
            const engine = preparedEngine(state, 'actor');
            const turn = controller.choose({
                level: 'turn',
                engine,
                state,
                actor: state.combatants.actor,
                legalDecisions: [
                    { kind: 'meleeAttack', actorId: 'actor', targetId: 'enemy' },
                    { kind: 'endTurn', actorId: 'actor' },
                ],
                rng: createSeededRng(`competence-${profile}`),
            });
            const death = controller.choose({
                level: 'resolution',
                reason: 'reaction:would-die',
                engine,
                state,
                actor: state.combatants.actor,
                legalDecisions: [{ kind: 'reaction', actorId: 'actor', trigger: 'would-die', reaction: 'dieAnotherDay' } as any],
                rng: createSeededRng(`death-${profile}`),
            });

            expect(turn?.kind).not.toBe('endTurn');
            expect(death).toMatchObject({ kind: 'reaction', reaction: 'dieAnotherDay' });
        }
    });

    it('focus-fires the wounded target deterministically and logs alternatives', () => {
        const state = createCombatState([
            combatant('actor', 'ally', ['sword'], 0),
            combatant('fresh', 'adversary', ['sword'], 1, { wounds: 12 }),
            combatant('wounded', 'adversary', ['sword'], 2, { wounds: 2, maxWounds: 12 }),
        ], { weapons: [sword] });
        const controller = new HeuristicController({ profile: 'brute' });
        const engine = preparedEngine(state, 'actor');
        const makeDecision = () => controller.choose({
            level: 'turn',
            engine,
            state,
            actor: state.combatants.actor,
            legalDecisions: [
                { kind: 'meleeAttack', actorId: 'actor', targetId: 'fresh' },
                { kind: 'meleeAttack', actorId: 'actor', targetId: 'wounded' },
            ],
            rng: createSeededRng('focus-fire'),
        });

        expect(makeDecision()).toMatchObject({ targetId: 'wounded' });
        expect(JSON.stringify(makeDecision())).toBe(JSON.stringify(makeDecision()));
        expect(makeDecision()?.decisionLog?.rejectedAlternatives.length).toBeGreaterThan(0);
    });

    it('emits structured decision logs into the event stream', () => {
        const state = createCombatState([
            combatant('actor', 'ally', ['sword'], 0),
            combatant('enemy', 'adversary', ['sword'], 0, { wounds: 4 }),
        ], { weapons: [sword] });
        const engine = preparedEngine(state, 'actor');
        const controller = new HeuristicController({ profile: 'brute' });
        const decision = controller.choose({
            level: 'turn',
            engine,
            state,
            actor: state.combatants.actor,
            legalDecisions: [{ kind: 'meleeAttack', actorId: 'actor', targetId: 'enemy' }],
            rng: engine.rng,
        })!;

        const resolved = applyDecision(engine, decision, controller);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: 'DecisionLogged',
            data: expect.objectContaining({ chosen: expect.stringContaining('meleeAttack'), reasonCode: 'action.attackBestTarget' }),
        }));
    });

    it('runs a heuristic-driven fight to termination unaided and deterministically', () => {
        const state = createCombatState([
            combatant('ally', 'ally', ['sword'], 0, { wounds: 10, maxWounds: 10 }),
            combatant('enemy', 'adversary', ['sword'], 7, { wounds: 10, maxWounds: 10 }),
        ], { weapons: [sword] });
        const run = () => runCombatToCompletion(state, new HeuristicController({ profile: 'berserker' }), { seed: 'heuristic-fight', maxRounds: 6 });

        const first = run();
        const second = run();

        expect(first.phase).toBe('complete');
        expect(JSON.stringify(first.state)).toBe(JSON.stringify(second.state));
    });
});

function preparedEngine(state: ReturnType<typeof createCombatState>, activeCombatantId: string) {
    return {
        ...createTurnEngine(state, { seed: 'heuristic' }),
        state,
        phase: 'awaitingDecision' as const,
        activeCombatantId,
        initiativeOrder: Object.keys(state.combatants),
        round: state.round,
        turnIndex: 0,
    };
}

function weapon(id: string, group: string, damage: string, qualities: string[]): Weapon {
    return { id, name: id, group, price: '1 GC', enc: 1, reach: group === 'bow' ? '50' : 'Average', damage, qualities, availability: 'Common' };
}

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], position: number, overrides: Record<string, any> = {}) {
    const wounds = overrides.wounds ?? overrides.maxWounds ?? 12;
    return createCombatantFromCharacter(characterFixture(id, weapons, { ...overrides, wounds }), {
        id,
        side,
        position,
        currentWounds: wounds,
        maxWounds: overrides.maxWounds ?? wounds,
        engagementIds: overrides.engagementIds ?? [],
        weaponLoadout: { primaryWeaponId: weapons[0] },
    });
}

function characterFixture(id: string, weapons: string[], overrides: Record<string, any> = {}): Character {
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
            ws: characteristic(55),
            bs: characteristic(55),
            s: characteristic(35),
            t: characteristic(30),
            i: characteristic(45),
            ag: characteristic(45),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(35),
            fel: characteristic(30),
        },
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'melee_fencing', name: 'Melee (Fencing)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'ranged_bow', name: 'Ranged (Bow)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 5, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: overrides.wounds ?? 12, max: overrides.maxWounds ?? overrides.wounds ?? 12 },
            fate: { current: overrides.fate ?? 0, max: overrides.fate ?? 0 },
            fortune: { current: overrides.fortune ?? 0, max: overrides.fortune ?? 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: overrides.talents ?? {},
        inventory: {
            weapons: Object.fromEntries(weapons.map(weapon => [weapon, 1])),
            armor: {},
            items: {},
            equippedWeapons: Object.fromEntries(weapons.map((weapon, index) => [weapon, index === 0])),
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
