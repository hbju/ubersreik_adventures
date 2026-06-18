import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    applyDecision,
    createCombatantFromCharacter,
    createCombatState,
    createTurnEngine,
    eligibleReactions,
    mathRandomRng,
    resolveReactionDecision,
    ScriptedController,
    type CombatantController,
    type CombatDecision,
} from '../../src/combat';

const sword = weapon('sword', 'basic', '+SB+4', []);
const rapier = weapon('rapier', 'fencing', '+SB+4', ['Fast']);
const shield = weapon('shield', 'shield', '+2', ['Shield 2', 'Defensive']);

describe('reaction windows and interrupts 5b', () => {
    it('offers Riposte only from a Fast-weapon melee defence and damages the attacker', () => {
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0, { wounds: 12 }),
            combatant('duellist', 'adversary', ['rapier'], 1, { talents: { riposte: 1 } }),
        ], { weapons: [sword, rapier] });
        const engine = preparedEngine(state, 'attacker', ['attacker', 'duellist']);
        const controller = new ScriptedController([
            context => context.reason === 'reaction:won-defensive-Melee'
                ? { kind: 'reaction', actorId: 'duellist', targetId: 'attacker', trigger: 'won-defensive-Melee', reaction: 'riposte' } as CombatDecision
                : undefined,
        ]);

        const resolved = applyDecision(engine, melee('attacker', 'duellist', 70, 10, 'sword', 'rapier'), controller);

        expect(eligibleReactions(state, { trigger: 'won-defensive-Melee', actorId: 'duellist', targetId: 'attacker' }).map(choice => choice.reaction)).toContain('riposte');
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'ReactionOffered', data: expect.objectContaining({ reaction: 'riposte' }) }));
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'ReactionResolved', data: expect.objectContaining({ reaction: 'riposte', chosen: true }) }));
        expect(resolved.state.combatants.attacker.currentWounds).toBeLessThan(12);

        const noFast = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0),
            combatant('parrier', 'adversary', ['sword'], 1, { talents: { riposte: 1 } }),
        ], { weapons: [sword] });
        expect(eligibleReactions(noFast, { trigger: 'won-defensive-Melee', actorId: 'parrier', targetId: 'attacker' }).map(choice => choice.reaction)).not.toContain('riposte');
    });

    it('resolves Reaction Strike before the charged target is attacked and only once per charger', () => {
        const state = createCombatState([
            combatant('charger', 'ally', ['sword'], 0, { wounds: 12 }),
            combatant('guard', 'adversary', ['sword'], 4, { talents: { 'reaction-strike': 1 } }),
        ], { weapons: [sword] });
        const engine = preparedEngine(state, 'charger', ['charger', 'guard']);
        const controller = new ScriptedController([
            context => context.reason === 'reaction:charged'
                ? { kind: 'reaction', actorId: 'guard', targetId: 'charger', trigger: 'charged', reaction: 'reactionStrike', rollResult: 1, targetNumber: 50 } as CombatDecision
                : undefined,
        ]);

        const charged = applyDecision(engine, { kind: 'move', actorId: 'charger', mode: 'charge', target: { combatantId: 'guard' } }, controller);

        const reactionIndex = charged.events.findIndex(event => event.type === 'TalentEffectApplied' && (event as any).data?.talentId === 'reaction-strike');
        const damageIndex = charged.events.findIndex(event => event.type === 'DamageDealt');
        expect(reactionIndex).toBeGreaterThan(-1);
        expect(damageIndex).toBeGreaterThan(reactionIndex);
        expect(charged.state.combatants.charger.currentWounds).toBeLessThan(12);
        expect(eligibleReactions(charged.state, { trigger: 'charged', actorId: 'guard', targetId: 'charger' })).toHaveLength(0);
    });

    it('Step Aside moves 2 yards and disengages on a Dodge defence win without spending an action', () => {
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0, { engagementIds: ['dodger'] }),
            combatant('dodger', 'adversary', ['sword'], 1, { engagementIds: ['attacker'] }),
        ], { weapons: [sword], engagements: { 'attacker:dodger': { aId: 'attacker', bId: 'dodger', lastAttackRound: 1 } }, round: 1 });
        const engine = preparedEngine(state, 'attacker', ['attacker', 'dodger']);
        const controller = new ScriptedController([
            context => context.reason === 'reaction:won-Dodge-defence'
                ? { kind: 'reaction', actorId: 'dodger', targetId: 'attacker', trigger: 'won-Dodge-defence', reaction: 'stepAside' } as CombatDecision
                : undefined,
        ]);

        const resolved = applyDecision(engine, {
            kind: 'meleeAttack',
            actorId: 'attacker',
            action: {
                attackerId: 'attacker',
                defenderId: 'dodger',
                attacker: { skillId: 'melee_basic', targetNumber: 45, rollResult: 65, weaponId: 'sword' },
                defender: { skillId: 'dodge', targetNumber: 60, rollResult: 10 },
            },
        }, controller);

        expect(resolved.state.combatants.dodger.position).toBe(3);
        expect(resolved.state.combatants.dodger.engagementIds).toEqual([]);
        expect(resolved.state.combatants.dodger.budget.actions).toBe(1);
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'DisengagedEvent', data: expect.objectContaining({ actionSpent: false }) }));
    });

    it('asks the defender controller to choose the opposed defence skill', () => {
        const calls: string[] = [];
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0, { engagementIds: ['defender'] }),
            combatant('defender', 'adversary', ['rapier'], 1, { engagementIds: ['attacker'] }),
        ], { weapons: [sword, rapier] });
        const engine = preparedEngine(state, 'attacker', ['attacker', 'defender']);
        const controllers: Record<string, CombatantController> = {
            attacker: { choose: context => { calls.push(`attacker:${context.reason}`); return undefined; } },
            defender: {
                choose: context => {
                    calls.push(`defender:${context.reason}`);
                    if (context.reason === 'defenceSkill') {
                        return { kind: 'meleeAttack', actorId: 'defender', defenceSkill: 'dodge' } as CombatDecision;
                    }
                    return undefined;
                },
            },
        };

        const resolved = applyDecision(engine, {
            kind: 'meleeAttack',
            actorId: 'attacker',
            action: {
                attackerId: 'attacker',
                defenderId: 'defender',
                attacker: { skillId: 'melee_basic', targetNumber: 45, rollResult: 65, weaponId: 'sword' },
                defender: { skillId: 'melee_basic', targetNumber: 0, rollResult: 10 },
            },
        }, controllers);

        const attack = resolved.events.find(event => event.type === 'AttackResolved');
        expect(calls).toContain('defender:defenceSkill');
        expect(calls).not.toContain('attacker:defenceSkill');
        expect(attack?.data.defenderRoll.skillId).toBe('dodge');
        expect(attack?.data.defenderRoll.targetNumber).toBe(55);
    });

    it('asks the charged target controller, not the charger controller, for charge reactions', () => {
        const calls: string[] = [];
        const state = createCombatState([
            combatant('charger', 'ally', ['sword'], 0, { wounds: 12 }),
            combatant('guard', 'adversary', ['sword'], 4, { talents: { 'reaction-strike': 1 } }),
        ], { weapons: [sword] });
        const engine = preparedEngine(state, 'charger', ['charger', 'guard']);
        const controllers: Record<string, CombatantController> = {
            charger: { choose: context => { calls.push(`charger:${context.reason}`); return undefined; } },
            guard: {
                choose: context => {
                    calls.push(`guard:${context.reason}`);
                    if (context.reason === 'reaction:charged') {
                        return { kind: 'reaction', actorId: 'guard', targetId: 'charger', trigger: 'charged', reaction: 'reactionStrike', rollResult: 1, targetNumber: 50 } as CombatDecision;
                    }
                    return undefined;
                },
            },
        };

        const charged = applyDecision(engine, { kind: 'move', actorId: 'charger', mode: 'charge', target: { combatantId: 'guard' } }, controllers);

        expect(calls).toContain('guard:reaction:charged');
        expect(calls).not.toContain('charger:reaction:charged');
        expect(charged.events).toContainEqual(expect.objectContaining({
            type: 'ReactionResolved',
            data: expect.objectContaining({ actorId: 'guard', reaction: 'reactionStrike', chosen: true }),
        }));
    });

    it('asks the defender controller for Fate damage interception', () => {
        const calls: string[] = [];
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0),
            combatant('fated', 'adversary', ['sword'], 1, { wounds: 6, fate: 1 }),
        ], { weapons: [sword] });
        const engine = preparedEngine(state, 'attacker', ['attacker', 'fated']);
        const controllers: Record<string, CombatantController> = {
            attacker: { choose: context => { calls.push(`attacker:${context.reason}`); return undefined; } },
            fated: {
                choose: context => {
                    calls.push(`fated:${context.reason}`);
                    if (context.reason === 'reaction:damage-about-to-apply') {
                        return { kind: 'reaction', actorId: 'fated', targetId: 'attacker', trigger: 'damage-about-to-apply', reaction: 'howDidThatMiss' } as CombatDecision;
                    }
                    return undefined;
                },
            },
        };

        const resolved = applyDecision(engine, melee('attacker', 'fated', 5, 95, 'sword', 'sword'), controllers);

        expect(calls).toContain('fated:reaction:damage-about-to-apply');
        expect(calls).not.toContain('attacker:reaction:damage-about-to-apply');
        expect(resolved.state.combatants.fated.currentWounds).toBe(6);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: 'FateInterceptionEvent',
            data: expect.objectContaining({ combatantId: 'fated', intercepted: 'damage' }),
        }));
    });

    it('How Did That Miss? negates incoming damage and spends Fate through the reaction window', () => {
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0),
            combatant('fated', 'adversary', ['sword'], 1, { wounds: 6, fate: 1 }),
        ], { weapons: [sword] });
        const engine = preparedEngine(state, 'attacker', ['attacker', 'fated']);
        const controller = new ScriptedController([
            context => context.reason === 'reaction:damage-about-to-apply'
                ? { kind: 'reaction', actorId: 'fated', targetId: 'attacker', trigger: 'damage-about-to-apply', reaction: 'howDidThatMiss' } as CombatDecision
                : undefined,
        ]);

        const resolved = applyDecision(engine, melee('attacker', 'fated', 5, 95, 'sword', 'sword'), controller);

        expect(resolved.state.combatants.fated.currentWounds).toBe(6);
        expect(resolved.state.combatants.fated.resources.fate?.current).toBe(0);
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'FateInterceptionEvent', data: expect.objectContaining({ intercepted: 'damage' }) }));
    });

    it('How Did That Miss? can intercept Riposte damage without opening a counter-Riposte loop', () => {
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0, { wounds: 12, fate: 1, talents: { riposte: 1 } }),
            combatant('duellist', 'adversary', ['rapier'], 1, { talents: { riposte: 1 } }),
        ], { weapons: [sword, rapier] });
        const engine = preparedEngine(state, 'attacker', ['attacker', 'duellist']);
        const controller = new ScriptedController([
            context => context.reason === 'reaction:won-defensive-Melee'
                ? { kind: 'reaction', actorId: 'duellist', targetId: 'attacker', trigger: 'won-defensive-Melee', reaction: 'riposte' } as CombatDecision
                : undefined,
            context => context.reason === 'reaction:damage-about-to-apply'
                ? { kind: 'reaction', actorId: 'attacker', targetId: 'duellist', trigger: 'damage-about-to-apply', reaction: 'howDidThatMiss' } as CombatDecision
                : undefined,
        ]);

        const resolved = applyDecision(engine, melee('attacker', 'duellist', 70, 10, 'sword', 'rapier'), controller);

        expect(resolved.state.combatants.attacker.currentWounds).toBe(12);
        expect(resolved.state.combatants.attacker.resources.fate?.current).toBe(0);
        expect(resolved.events.filter(event => event.type === 'ReactionOffered' && (event as any).data?.reaction === 'riposte')).toHaveLength(1);
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'FateInterceptionEvent', data: expect.objectContaining({ intercepted: 'damage' }) }));
    });

    it('Die Another Day marks the combatant removed instead of dead', () => {
        const state = createCombatState([
            combatant('doomed', 'ally', ['sword'], 0, { wounds: 0, fate: 1 }),
        ], { weapons: [sword] });

        const resolved = resolveReactionDecision(state, {
            kind: 'reaction',
            actorId: 'doomed',
            trigger: 'would-die',
            reaction: 'dieAnotherDay',
        }, {
            trigger: 'would-die',
            actorId: 'doomed',
        }, mathRandomRng);

        expect(resolved.state.combatants.doomed.removedFromEncounter).toBe(true);
        expect(resolved.state.combatants.doomed.conditions).toContain('condition_unconscious');
        expect(resolved.state.combatants.doomed.resources.fate?.current).toBe(0);
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'FateInterceptionEvent', data: expect.objectContaining({ intercepted: 'death' }) }));
    });

    it('offers only reactive Advantage exceptions on defence, never Additional Effort', () => {
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0),
            combatant('defender', 'adversary', ['shield'], 1, { talents: { shieldsman: 1, reversal: 1 } }),
        ], { weapons: [sword, shield], advantagePools: { ally: 1, adversary: 2 } });

        const reactions = eligibleReactions(state, { trigger: 'won-defensive-Melee', actorId: 'defender', targetId: 'attacker' }).map(choice => choice.reaction);

        expect(reactions).toEqual(expect.arrayContaining(['shieldsman', 'reversal']));
        expect(reactions).not.toContain('fortunePlusOneSl');
        expect(reactions).not.toContain('fortuneReroll');
    });

    it('keeps reaction offers deterministic in initiative order', () => {
        const state = createCombatState([
            combatant('attacker', 'ally', ['sword'], 0),
            combatant('b', 'adversary', ['sword'], 1, { talents: { 'reaction-strike': 1 } }),
            combatant('a', 'adversary', ['sword'], 2, { talents: { 'reaction-strike': 1 } }),
        ], { weapons: [sword] });
        const run = () => applyDecision(
            preparedEngine(state, 'attacker', ['attacker', 'a', 'b']),
            { kind: 'move', actorId: 'attacker', mode: 'charge', target: { combatantId: 'a' } },
            new ScriptedController([() => undefined]),
        );

        expect(JSON.stringify(run().events)).toBe(JSON.stringify(run().events));
        expect(run().events.find(event => event.type === 'ReactionOffered')?.data).toMatchObject({ actorId: 'a' });
    });
});

function preparedEngine(state: ReturnType<typeof createCombatState>, activeCombatantId: string, initiativeOrder: string[]) {
    return {
        ...createTurnEngine(state, { seed: 'reactions' }),
        state,
        phase: 'awaitingDecision' as const,
        activeCombatantId,
        initiativeOrder,
        round: state.round,
        turnIndex: initiativeOrder.indexOf(activeCombatantId),
    };
}

function melee(actorId: string, defenderId: string, attackerRoll: number, defenderRoll: number, attackerWeaponId: string, defenderWeaponId: string): CombatDecision {
    return {
        kind: 'meleeAttack',
        actorId,
        action: {
            attackerId: actorId,
            defenderId,
            attacker: { skillId: 'melee_basic', targetNumber: 55, rollResult: attackerRoll, weaponId: attackerWeaponId },
            defender: { skillId: 'melee_basic', targetNumber: 55, rollResult: defenderRoll, weaponId: defenderWeaponId },
        },
    };
}

function weapon(id: string, group: string, damage: string, qualities: string[]): Weapon {
    return { id, name: id, group, price: '1 GC', enc: 1, reach: 'Average', damage, qualities, availability: 'Common' };
}

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], position: number, overrides: Record<string, any> = {}) {
    return createCombatantFromCharacter(characterFixture(id, weapons, overrides), {
        id,
        side,
        position,
        currentWounds: overrides.wounds,
        maxWounds: overrides.wounds,
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
            ws: characteristic(50),
            bs: characteristic(50),
            s: characteristic(30),
            t: characteristic(30),
            i: characteristic(50),
            ag: characteristic(50),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'melee_fencing', name: 'Melee (Fencing)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 5, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: overrides.wounds ?? 12, max: overrides.wounds ?? 12 },
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
