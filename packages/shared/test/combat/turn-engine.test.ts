import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    advanceToNextDecision,
    applyDecision,
    ACTION_CATALOGUE,
    cloneTurnEngine,
    createCombatState,
    createCombatantFromCharacter,
    createTurnEngine,
    legalDecisions,
    runCombatToCompletion,
    ScriptedController,
    type CombatDecision,
} from '../../src/combat';

const sword: Weapon = weapon('sword', 'basic', '+SB+4', []);
const fastSword: Weapon = weapon('fast-sword', 'basic', '+SB+4', ['Fast']);
const slowSword: Weapon = weapon('slow-sword', 'basic', '+SB+4', ['Slow']);
const bow: Weapon = weapon('bow', 'bow', '+8', []);
const handgun: Weapon = weapon('handgun', 'blackpowder', '+9', ['Reload 3', 'Blackpowder']);
const shield: Weapon = weapon('shield', 'shield', '+2', ['Shield 2', 'Defensive']);
const hook: Weapon = weapon('hook', 'basic', '+SB+4', ['Trip']);

describe('turn engine 5a', () => {
    it('runs a scripted 1v1 to completion deterministically by seed', () => {
        const run = () => runCombatToCompletion(oneVsOne(), new ScriptedController([
            context => context.actor.side === 'ally' ? melee(context.actor.id, 'enemy', 12) : end(context.actor.id),
            context => end(context.actor.id),
        ]), { seed: 'turn-1v1', maxRounds: 3 });

        const first = run();
        const second = run();

        expect(first.phase).toBe('complete');
        expect(first.outcome).toBe('ally');
        expect(JSON.stringify(first.state)).toBe(JSON.stringify(second.state));
    });

    it('runs a scripted 2v2 and preserves stepwise pause/resume', () => {
        const state = createCombatState([
            combatant('a1', 'ally', ['sword'], 0),
            combatant('a2', 'ally', ['sword'], 1),
            combatant('e1', 'adversary', ['sword'], 2, { wounds: 3 }),
            combatant('e2', 'adversary', ['sword'], 3, { wounds: 3 }),
        ], { weapons: [sword] });
        const decisions = new ScriptedController([
            context => context.actor.side === 'ally' ? melee(context.actor.id, context.actor.id === 'a1' ? 'e1' : 'e2', 12) : end(context.actor.id),
            context => end(context.actor.id),
            context => context.actor.side === 'ally' ? melee(context.actor.id, context.actor.id === 'a1' ? 'e1' : 'e2', 12) : end(context.actor.id),
            context => end(context.actor.id),
        ]);

        const completed = runCombatToCompletion(state, decisions, { seed: 'turn-2v2', maxRounds: 3 });
        let stepwise = advanceToNextDecision(createTurnEngine(state, { seed: 'turn-2v2', maxRounds: 3 }));
        stepwise = applyDecision(stepwise, melee(stepwise.activeCombatantId!, stepwise.activeCombatantId === 'a1' ? 'e1' : 'e2', 12));

        expect(completed.phase).toBe('complete');
        expect(completed.outcome).toBe('ally');
        expect(stepwise.phase).toBe('awaitingDecision');
    });

    it('orders initiative with Act First, Fast, Slow, and deterministic tie-breakers', () => {
        const state = createCombatState([
            { ...combatant('fast', 'ally', ['fast-sword'], 0), initiativeOverride: true },
            combatant('slow', 'ally', ['slow-sword'], 1),
            combatant('plain', 'adversary', ['sword'], 2),
        ], { weapons: [sword, fastSword, slowSword] });

        const engine = advanceToNextDecision(createTurnEngine(state, { seed: 'initiative' }));

        expect(engine.initiativeOrder[0]).toBe('fast');
        expect(engine.initiativeOrder[engine.initiativeOrder.length - 1]).toBe('slow');
    });

    it('enforces action economy and Advantage extra action budget', () => {
        let engine = advanceToNextDecision(createTurnEngine(oneVsOne(), { seed: 'budget' }));
        const actorId = engine.activeCombatantId!;
        engine = { ...engine, state: { ...engine.state, advantagePools: { ...engine.state.advantagePools, [engine.state.combatants[actorId].side]: 4 } } };

        engine = applyDecision(engine, { kind: 'spendAdvantage', actorId, advantageAction: 'additionalAction' });
        expect(engine.state.combatants[actorId].budget.actions).toBe(2);
        expect(legalDecisions(engine.state, engine.state.combatants[actorId]).filter(decision => decision.kind === 'spendAdvantage')).toHaveLength(0);

        engine = applyDecision(engine, { kind: 'move', actorId, mode: 'run', target: 1 });
        expect(engine.state.combatants[actorId].budget.actions).toBe(1);

        const furiousActor = combatant('furious', 'ally', ['sword'], 0, { talents: { 'furious-assault': 1 } });
        const furiousState = createCombatState([furiousActor, combatant('target', 'adversary', ['sword'], 2)], { weapons: [sword], advantagePools: { ally: 1, adversary: 0 } });
        const furious = applyDecision({
            ...advanceToNextDecision(createTurnEngine(furiousState, { seed: 'furious' })),
            state: furiousState,
            phase: 'awaitingDecision',
            activeCombatantId: 'furious',
        }, { kind: 'spendAdvantage', actorId: 'furious', advantageAction: 'furiousAssault' });
        expect(furious.state.combatants.furious.budget.actions).toBe(2);
        expect(furious.state.combatants.furious.budget.moves).toBe(0);
    });

    it('enumerates legal decisions under condition, engagement, reload, proficiency, and budget gates', () => {
        const stunned = combatant('stunned', 'ally', ['sword'], 0, { conditions: ['condition_stunned'] });
        expect(legalDecisions(createCombatState([stunned], { weapons: [sword] }), stunned).map(decision => decision.kind)).not.toContain('meleeAttack');

        const engagedArcher = combatant('archer', 'ally', ['bow'], 0, { engagementIds: ['enemy'] });
        const enemy = combatant('enemy', 'adversary', ['sword'], 0, { engagementIds: ['archer'] });
        expect(legalDecisions(createCombatState([engagedArcher, enemy], { weapons: [bow, sword] }), engagedArcher).map(decision => decision.kind)).not.toContain('rangedAttack');

        const reloader = combatant('gunner', 'ally', ['handgun'], 0, {
            weaponAmmo: { handgun: { loaded: false, reloadProgress: null } },
        });
        expect(legalDecisions(createCombatState([reloader, enemy], { weapons: [handgun, sword] }), reloader).map(decision => decision.kind)).toContain('reload');

        const untrained = combatant('untrained', 'ally', ['bow'], 0, { rangedBowAdvances: 0 });
        expect(legalDecisions(createCombatState([untrained, enemy], { weapons: [bow, sword] }), untrained).map(decision => decision.kind)).not.toContain('rangedAttack');
    });

    it('exposes a catalogue with concrete parameterized decisions', () => {
        const state = oneVsOne({ advantage: { ally: 4 } });
        const decisions = legalDecisions(state, state.combatants.ally);

        expect(ACTION_CATALOGUE.map(entry => entry.kind)).toEqual(expect.arrayContaining([
            'meleeAttack',
            'rangedAttack',
            'reload',
            'move',
            'assess',
            'infighting',
            'attackWithBoth',
            'shieldsman',
        ]));
        expect(decisions).toContainEqual(expect.objectContaining({ kind: 'meleeAttack', targetId: 'enemy' }));
        expect(decisions.some(decision => decision.kind === 'move' && decision.target !== undefined && decision.mode === 'walk')).toBe(true);
        expect(decisions).toContainEqual(expect.objectContaining({ kind: 'spendAdvantage', advantageAction: 'additionalAction' }));
    });

    it('dispatches catalogue special actions through the turn engine', () => {
        const state = createCombatState([
            combatant('archer', 'ally', ['bow'], 0),
            combatant('enemy', 'adversary', ['sword'], 8),
        ], { weapons: [bow, sword] });
        const prepared = {
            ...advanceToNextDecision(createTurnEngine(state, { seed: 'aim-dispatch' })),
            state,
            phase: 'awaitingDecision' as const,
            activeCombatantId: 'archer',
        };

        const engine = applyDecision(prepared, { kind: 'aim', actorId: 'archer' });

        expect(engine.state.combatants.archer.aimedRangedAttack).toBe(true);
        expect(engine.events).toContainEqual(expect.objectContaining({ type: 'CombatActionResolved', data: expect.objectContaining({ kind: 'aim' }) }));
    });

    it('threads resolution sub-decisions through the same controller', () => {
        const state = createCombatState([
            combatant('ally', 'ally', ['sword'], 0, { engagementIds: ['enemy'] }),
            combatant('enemy', 'adversary', ['sword'], 0, { engagementIds: ['ally'] }),
        ], {
            weapons: [sword],
            engagements: { 'ally:enemy': { aId: 'ally', bId: 'enemy', lastAttackRound: 0 } },
        });
        const prepared = {
            ...advanceToNextDecision(createTurnEngine(state, { seed: 'subdecision' })),
            state,
            phase: 'awaitingDecision' as const,
            activeCombatantId: 'ally',
        };
        const controller = new ScriptedController([
            context => context.level === 'resolution' ? { kind: 'infighting', actorId: 'ally', targetId: 'enemy', infightingMode: 'normal' } : undefined,
        ]);

        const engine = applyDecision(prepared, {
            kind: 'infighting',
            actorId: 'ally',
            targetId: 'enemy',
            request: { kind: 'infighting', actorId: 'ally', targetId: 'enemy', rollResult: 1, opponentRollResult: 99 },
        }, controller);

        expect(engine.events).toContainEqual(expect.objectContaining({
            type: 'CombatActionResolved',
            data: expect.objectContaining({ kind: 'infighting', infightingMode: false }),
        }));
    });

    it('dispatches activated talent decisions with controller-selected modes', () => {
        const state = createCombatState([
            combatant('shieldbearer', 'ally', ['shield'], 0, { talents: { shieldsman: 1 } }),
            combatant('enemy', 'adversary', ['sword'], 0, { wounds: 5 }),
        ], { weapons: [shield, sword], advantagePools: { ally: 2, adversary: 0 } });
        const prepared = {
            ...advanceToNextDecision(createTurnEngine(state, { seed: 'shieldsman' })),
            state,
            phase: 'awaitingDecision' as const,
            activeCombatantId: 'shieldbearer',
        };
        const controller = new ScriptedController([
            context => context.level === 'resolution' ? { kind: 'shieldsman', actorId: 'shieldbearer', targetId: 'enemy', shieldsmanMode: 'damage' } : undefined,
        ]);

        const engine = applyDecision(prepared, { kind: 'shieldsman', actorId: 'shieldbearer', targetId: 'enemy' }, controller);

        expect(engine.state.combatants.enemy.currentWounds).toBeLessThan(5);
        expect(engine.events).toContainEqual(expect.objectContaining({
            type: 'TalentEffectApplied',
            data: expect.objectContaining({ talentId: 'shieldsman', effect: 'damage' }),
        }));
    });

    it('applies deferred quality activations through resolution decisions', () => {
        const state = createCombatState([
            combatant('ally', 'ally', ['hook'], 0),
            combatant('enemy', 'adversary', ['sword'], 0),
        ], { weapons: [hook, sword], advantagePools: { ally: 2, adversary: 0 } });
        const prepared = {
            ...advanceToNextDecision(createTurnEngine(state, { seed: 'trip-activation' })),
            state,
            phase: 'awaitingDecision' as const,
            activeCombatantId: 'ally',
        };
        const controller = new ScriptedController([
            context => context.level === 'resolution' ? { kind: 'spendAdvantage', actorId: 'ally', targetId: 'enemy' } : undefined,
        ]);

        const engine = applyDecision(prepared, {
            kind: 'meleeAttack',
            actorId: 'ally',
            action: {
                attackerId: 'ally',
                defenderId: 'enemy',
                attacker: { skillId: 'melee_basic', targetNumber: 75, rollResult: 12, weaponId: 'hook' },
                defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 95, weaponId: 'sword' },
            },
        }, controller);

        expect(engine.state.advantagePools.ally).toBe(1);
        expect(engine.state.combatants.enemy.conditions).toContain('condition_prone');
        expect(engine.events).toContainEqual(expect.objectContaining({
            type: 'ResolutionDecisionRequested',
            data: expect.objectContaining({ reason: 'qualityActivation', qualityId: 'trip', chosen: 'spendAdvantage' }),
        }));
    });

    it('fires end-of-round orchestration in sequence and terminates on max-round draw', () => {
        const state = createCombatState([
            combatant('ally', 'ally', ['sword'], 0, { conditions: ['condition_bleeding'], wounds: 5 }),
            combatant('enemy', 'adversary', ['sword'], 2),
        ], { weapons: [sword] });

        let engine = advanceToNextDecision(createTurnEngine(state, { seed: 'round-sequence', maxRounds: 1 }));
        engine = applyDecision(engine, end(engine.activeCombatantId!));
        engine = applyDecision(advanceToNextDecision(engine), end(advanceToNextDecision(engine).activeCombatantId!));
        engine = advanceToNextDecision(engine);

        const types = engine.events.map(event => event.type);
        expect(types.indexOf('ConditionDamage')).toBeGreaterThan(-1);
        expect(types.indexOf('AdvantageReallocatedEvent')).toBeGreaterThan(types.indexOf('ConditionDamage'));
        expect(types.indexOf('RoundSequenceResolved')).toBeGreaterThan(types.indexOf('AdvantageReallocatedEvent'));
        expect(engine.phase).toBe('complete');
        expect(engine.outcome).toBe('draw');
    });

    it('forks and diverges from the same paused decision point', () => {
        const paused = advanceToNextDecision(createTurnEngine(oneVsOne(), { seed: 'fork' }));
        const left = applyDecision(cloneTurnEngine(paused), { kind: 'move', actorId: paused.activeCombatantId!, mode: 'walk', target: 1 });
        const right = applyDecision(cloneTurnEngine(paused), end(paused.activeCombatantId!));

        expect(left.state.combatants[paused.activeCombatantId!].position).not.toBe(right.state.combatants[paused.activeCombatantId!].position);
    });
});

function oneVsOne(options: { advantage?: { ally?: number; adversary?: number } } = {}) {
    return createCombatState([
        combatant('ally', 'ally', ['sword'], 0),
        combatant('enemy', 'adversary', ['sword'], 2, { wounds: 3 }),
    ], { weapons: [sword], advantagePools: options.advantage });
}

function melee(actorId: string, defenderId: string, rollResult: number): CombatDecision {
    return {
        kind: 'meleeAttack',
        actorId,
        action: {
            attackerId: actorId,
            defenderId,
            attacker: { skillId: 'melee_basic', targetNumber: 75, rollResult, weaponId: 'sword' },
            defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 95, weaponId: 'sword' },
        },
    };
}

function end(actorId: string): CombatDecision {
    return { kind: 'endTurn', actorId };
}

function weapon(id: string, group: string, damage: string, qualities: string[] = []): Weapon {
    return { id, name: id, group, price: '1 GC', enc: 1, reach: group === 'bow' || group === 'blackpowder' ? '50' : 'Average', damage, qualities, availability: 'Common' };
}

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], position: number, overrides: Record<string, any> = {}) {
    return createCombatantFromCharacter(characterFixture(id, weapons, overrides), {
        id,
        side,
        position,
        currentWounds: overrides.wounds,
        maxWounds: overrides.wounds,
        conditions: overrides.conditions ?? [],
        engagementIds: overrides.engagementIds ?? [],
        weaponLoadout: { primaryWeaponId: weapons[0] },
        weaponAmmo: overrides.weaponAmmo,
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
            { id: 'ranged_bow', name: 'Ranged (Bow)', characteristic: 'bs', advances: overrides.rangedBowAdvances ?? 5, talents: 0, modifier: 0 },
            { id: 'ranged_blackpowder', name: 'Ranged (Blackpowder)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: overrides.wounds ?? 12, max: overrides.wounds ?? 12 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
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
