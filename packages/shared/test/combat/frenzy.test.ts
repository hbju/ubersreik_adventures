import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/types/wfrp.types';
import {
    ACTION_CATALOGUE,
    HeuristicController,
    applyDecision,
    createCombatState,
    createCombatantFromCharacter,
    createSeededRng,
    createTurnEngine,
    isFrenzied,
    legalDecisions,
    resolveFrenzyExits,
    resolveMeleeAttack,
    resolvePsychologyExposure,
    type CombatDecision,
    type CombatState,
    type TurnEngineState,
} from '../../src/combat';

describe('PSY-b Frenzy', () => {
    it('requires Frenzy and a successful deterministic Willpower Test to enter', () => {
        const withoutTalent = readyEngine(stateFor(combatant('actor', 'ally'), combatant('enemy', 'adversary')));
        expect(legalDecisions(withoutTalent.state, withoutTalent.state.combatants.actor).map(d => d.kind))
            .not.toContain('frenzyEnter');

        const failed = applyDecision(
            readyEngine(stateFor(combatant('actor', 'ally', { frenzy: 1 }), combatant('enemy', 'adversary'))),
            { kind: 'frenzyEnter', actorId: 'actor', rollResult: 91 }
        );
        expect(isFrenzied(failed.state.combatants.actor)).toBe(false);
        expect(failed.state.combatants.actor.budget.actions).toBe(0);

        const passed = applyDecision(
            readyEngine(stateFor(combatant('actor', 'ally', { frenzy: 1 }), combatant('enemy', 'adversary'))),
            { kind: 'frenzyEnter', actorId: 'actor', rollResult: 11 }
        );
        expect(isFrenzied(passed.state.combatants.actor)).toBe(true);
        expect(passed.state.combatants.actor.psychology?.immuneToAllPsychology).toBe(true);

        const run = () => applyDecision(
            readyEngine(stateFor(combatant('actor', 'ally', { frenzy: 1 }), combatant('enemy', 'adversary')), 'frenzy-seed'),
            { kind: 'frenzyEnter', actorId: 'actor' }
        );
        const first = run();
        const second = run();
        expect(first.state.combatants.actor.psychology).toEqual(second.state.combatants.actor.psychology);
        expect(first.events.filter(event => event.type === 'FrenzyTestResolved'))
            .toEqual(second.events.filter(event => event.type === 'FrenzyTestResolved'));
    });

    it('lets a Flagellant with Frenzy enter automatically and grants Fear immunity', () => {
        const actor = combatant('actor', 'ally', { frenzy: 1, flagellant: 1 });
        const source = {
            ...combatant('enemy', 'adversary'),
            causesFear: { rating: 3 },
        };
        const entered = applyDecision(
            readyEngine(stateFor(actor, source)),
            { kind: 'frenzyEnter', actorId: 'actor', rollResult: 100 }
        );
        const exposure = resolvePsychologyExposure(
            entered.state,
            'actor',
            'enemy',
            createSeededRng('flagellant-fear')
        );

        expect(isFrenzied(entered.state.combatants.actor)).toBe(true);
        expect(entered.events).toContainEqual(expect.objectContaining({
            type: 'FrenzyTestResolved',
            data: expect.objectContaining({ automatic: true, success: true }),
        }));
        expect(exposure.events).toEqual([]);
    });

    it('restricts decisions to closing on and attacking the nearest enemy', () => {
        const actor = frenzied(combatant('actor', 'ally', { frenzy: 1 }));
        const nearest = { ...combatant('near', 'adversary'), position: 5 };
        const farther = { ...combatant('far', 'adversary'), position: 9 };
        const state = stateFor(actor, nearest, farther);
        const legal = legalDecisions(state, state.combatants.actor);

        expect(legal.map(decision => decision.kind)).not.toEqual(expect.arrayContaining([
            'defend',
            'rangedAttack',
            'disengageDodge',
            'assess',
            'aim',
            'reload',
            'endTurn',
        ]));
        expect(legal.filter(decision => decision.targetId).every(decision => decision.targetId === 'near')).toBe(true);
        expect(legal).toContainEqual(expect.objectContaining({
            kind: 'move',
            mode: 'run',
            targetId: 'near',
        }));
    });

    it('grants exactly one extra Melee Test per round', () => {
        const actor = frenzied(combatant('actor', 'ally', { frenzy: 1 }));
        const enemy = { ...combatant('enemy', 'adversary'), position: 1, currentWounds: 100, maxWounds: 100 };
        const state = stateFor(actor, enemy);
        const entry = ACTION_CATALOGUE.find(candidate => candidate.kind === 'meleeAttack')!;
        const decision = meleeDecision();
        const engine = readyEngine(state);

        const first = entry.dispatch(engine, decision);
        expect(first.state.combatants.actor.budget.actions).toBe(0);
        expect(entry.legal(first.state, first.state.combatants.actor)).toHaveLength(1);

        const second = entry.dispatch({ ...engine, state: first.state }, decision);
        expect(second.state.turnFlags.frenzyFreeAttackCombatantIds).toEqual(['actor']);
        expect(second.state.combatants.actor.psychology?.frenzy?.freeMeleeTestUsedRound).toBe(1);
        expect(entry.legal(second.state, second.state.combatants.actor)).toHaveLength(0);
    });

    it('adds +1 Strength Bonus damage while Frenzied', () => {
        const normal = stateFor(combatant('actor', 'ally'), durableEnemy());
        const frenzy = stateFor(frenzied(combatant('actor', 'ally', { frenzy: 1 })), durableEnemy());
        const normalDamage = resolveMeleeAttack(normal, meleeDecision().action!, createSeededRng('damage'))
            .events.find(event => event.type === 'DamageDealt')?.data.rawDamage;
        const frenzyDamage = resolveMeleeAttack(frenzy, meleeDecision().action!, createSeededRng('damage'))
            .events.find(event => event.type === 'DamageDealt')?.data.rawDamage;

        expect(frenzyDamage).toBe((normalDamage ?? 0) + 1);
    });

    it('is immune to Fear and Terror while active', () => {
        const actor = frenzied(combatant('actor', 'ally', { frenzy: 1 }));
        const source = {
            ...combatant('enemy', 'adversary'),
            causesFear: { rating: 2 },
            causesTerror: { rating: 3 },
        };
        const result = resolvePsychologyExposure(
            stateFor(actor, source),
            'actor',
            'enemy',
            createSeededRng('psychology-immunity')
        );

        expect(result.events).toEqual([]);
        expect(result.state.combatants.actor.psychology?.fears).toEqual({});
        expect(result.state.combatants.actor.psychology?.terrors).toEqual({});
    });

    it('exits on no active enemies or incapacitation and applies one Fatigued', () => {
        const actor = frenzied(combatant('actor', 'ally', { frenzy: 1 }));
        const unconsciousEnemy = {
            ...combatant('enemy', 'adversary'),
            conditions: ['condition_unconscious'],
        };
        const noEnemies = resolveFrenzyExits(stateFor(actor, unconsciousEnemy));
        expect(isFrenzied(noEnemies.state.combatants.actor)).toBe(false);
        expect(noEnemies.state.combatants.actor.conditions).toContain('condition_fatigued');

        const stunned = {
            ...frenzied(combatant('actor', 'ally', { frenzy: 1 })),
            conditions: ['condition_stunned'],
        };
        const incapacitated = resolveFrenzyExits(stateFor(stunned, combatant('enemy', 'adversary')));
        expect(isFrenzied(incapacitated.state.combatants.actor)).toBe(false);
        expect(incapacitated.state.combatants.actor.conditions.filter(id => id === 'condition_fatigued')).toHaveLength(1);
    });

    it('allows Battle Rage to end Frenzy with a Cool Test', () => {
        const actor = frenzied(combatant('actor', 'ally', { frenzy: 1, 'battle-rage': 1 }));
        const result = applyDecision(
            readyEngine(stateFor(actor, combatant('enemy', 'adversary'))),
            { kind: 'frenzyExit', actorId: 'actor', rollResult: 11 }
        );

        expect(isFrenzied(result.state.combatants.actor)).toBe(false);
        expect(result.state.combatants.actor.conditions).toContain('condition_fatigued');
    });

    it('makes a berserker choose Frenzy and ignore Broken retreat once active', () => {
        const actor = combatant('actor', 'ally', { frenzy: 1 });
        const enemy = { ...combatant('enemy', 'adversary'), position: 1 };
        const state = stateFor(actor, enemy);
        const controller = new HeuristicController({ profile: 'berserker' });
        const decision = controller.choose({
            level: 'turn',
            engine: readyEngine(state),
            state,
            actor,
            rng: createSeededRng('frenzy-ai'),
            legalDecisions: legalDecisions(state, actor),
        });
        expect(decision?.kind).toBe('frenzyEnter');

        const brokenActor = {
            ...frenzied(actor),
            conditions: ['condition_broken'],
        };
        const brokenState = stateFor(brokenActor, enemy);
        const aggressive = controller.choose({
            level: 'turn',
            engine: readyEngine(brokenState),
            state: brokenState,
            actor: brokenActor,
            rng: createSeededRng('frenzy-broken-ai'),
            legalDecisions: legalDecisions(brokenState, brokenActor),
        });
        expect(aggressive?.kind).toBe('meleeAttack');
    });
});

function readyEngine(state: CombatState, seed: string | number = 'frenzy-test'): TurnEngineState {
    return {
        ...createTurnEngine(state, { seed }),
        state,
        phase: 'awaitingDecision',
        round: state.round,
        activeCombatantId: 'actor',
        initiativeOrder: Object.keys(state.combatants),
    };
}

function stateFor(...combatants: ReturnType<typeof combatant>[]): CombatState {
    return createCombatState(combatants, { round: 1 });
}

function frenzied<T extends ReturnType<typeof combatant>>(actor: T): T {
    return {
        ...actor,
        psychology: {
            fears: {},
            terrors: {},
            frenzy: { active: true, enteredRound: 1 },
            immuneToAllPsychology: true,
        },
    };
}

function durableEnemy() {
    return {
        ...combatant('enemy', 'adversary'),
        position: 1,
        currentWounds: 100,
        maxWounds: 100,
    };
}

function meleeDecision(): CombatDecision {
    return {
        kind: 'meleeAttack',
        actorId: 'actor',
        targetId: 'enemy',
        action: {
            attackerId: 'actor',
            defenderId: 'enemy',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 11 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 91 },
        },
    };
}

function combatant(
    id: string,
    side: 'ally' | 'adversary',
    talents: Record<string, number> = {}
) {
    return createCombatantFromCharacter(character(id, talents), {
        id,
        side,
        position: side === 'ally' ? 0 : 10,
    });
}

function character(id: string, talents: Record<string, number>): Character {
    const characteristic = (initial: number) => ({ initial, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: sideUser(id),
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
            ws: characteristic(50), bs: characteristic(40), s: characteristic(40),
            t: characteristic(30), i: characteristic(30), ag: characteristic(id === 'actor' ? 80 : 20),
            dex: characteristic(30), int: characteristic(30), wp: characteristic(50),
            fel: characteristic(30),
        },
        skills: [
            { id: 'cool', name: 'Cool', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 20, max: 20 },
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

function sideUser(id: string): string | null {
    return id === 'actor' ? 'player' : null;
}
