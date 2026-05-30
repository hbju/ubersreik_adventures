import { describe, expect, it } from 'vitest';
import type { Character, Characteristic } from '../src/types/wfrp.types';
import {
    createCombatantFromCharacter,
    createCombatState,
    resolveMeleeAttack,
} from '../src/combat/engine';
import {
    accumulatedCriticalDeathCheck,
    applySuddenDeathAtZero,
    coupDeGrace,
    criticalRoll,
    criticalRollModifier,
} from '../src/combat/critical';
import { createSeededRng } from '../src/combat/rng';
import type { CombatState, CritResolverContext, MeleeResolutionHooks } from '../src/combat/types';

describe('critical wounds, injuries, and death', () => {
    it('applies critical roll modifier math and floors modified rolls at 01', () => {
        const state = stateWithTarget({ toughness: 35 });
        const target = state.combatants.target;

        expect(criticalRollModifier(context(state, { woundsBeyondZero: 1 }), target)).toBe(-10);
        expect(criticalRollModifier(context(state, { woundsBeyondZero: 2 }), target)).toBe(0);
        expect(criticalRollModifier(context(state, { woundsBeyondZero: 3 }), target)).toBe(30);

        const floored = criticalRoll(context(state, { woundsBeyondZero: 1 }), {
            locationRoll: 30,
            resultRoll: 5,
        });
        expect(floored.events.find(event => event.type === 'CriticalWoundResolved')).toMatchObject({
            data: { modifiedRoll: 1, modifier: -10, name: 'Dramatic Injury', trivial: true },
        });
    });

    it('resolves the four tables by explicit location/result rolls', () => {
        const state = stateWithTarget();
        const cases = [
            { locationRoll: 30, resultRoll: 4, name: 'Rattling Blow' },
            { locationRoll: 12, resultRoll: 26, name: 'Sprain' },
            { locationRoll: 54, resultRoll: 51, name: 'Cracked Ribs' },
            { locationRoll: 8, resultRoll: 71, name: 'Hacked Leg' },
        ];

        for (const testCase of cases) {
            const result = criticalRoll(context(state), testCase);
            expect(result.events.find(event => event.type === 'CriticalWoundResolved')).toMatchObject({
                data: { name: testCase.name },
            });
        }
    });

    it('keeps critical outcomes deterministic for identical seeds', () => {
        const run = () => criticalRoll(context(stateWithTarget()), { rng: createSeededRng('critical-seed') });

        expect(run()).toEqual(run());
    });

    it('applies extra wounds without triggering another critical from the same blow', () => {
        const result = criticalRoll(context(stateWithTarget({ wounds: 3 })), {
            locationRoll: 54,
            resultRoll: 96,
        });

        expect(result.events.filter(event => event.type === 'CriticalWoundResolved')).toHaveLength(1);
        expect(result.state.combatants.target.currentWounds).toBe(0);
    });

    it('excludes Trivial criticals from accumulated death totals', () => {
        const result = criticalRoll(context(stateWithTarget()), {
            locationRoll: 30,
            resultRoll: 1,
        });

        expect((result.state.combatants.target as any).criticalWounds || []).toHaveLength(0);
    });

    it('applies amputation Endurance failure branches', () => {
        const result = criticalRoll(context(stateWithTarget()), {
            locationRoll: 30,
            resultRoll: 61,
            amputationTestOutcome: -4,
        });

        expect(result.state.combatants.target.conditions).toEqual(expect.arrayContaining([
            'condition_prone',
            'condition_stunned',
            'condition_unconscious',
        ]));
        expect((result.state.combatants.target as any).injuries).toContainEqual(expect.objectContaining({
            type: 'amputation',
            partLost: 'ear',
        }));
    });

    it('kills from accumulated criticals, coup de grace, and sudden death when allowed', () => {
        const accumulatedState = createCombatState([
            createCombatantFromCharacter(character('target', 'Target', { toughness: 20, wounds: 0 }), {
                side: 'adversary',
                currentWounds: 0,
                conditions: ['condition_unconscious'],
            }) as any,
        ]);
        (accumulatedState.combatants.target as any).criticalWounds = [
            { trivial: false },
            { trivial: false },
            { trivial: false },
        ];

        expect((accumulatedCriticalDeathCheck(accumulatedState, 'target').state.combatants.target as any).dead).toBe(true);
        expect((coupDeGrace(accumulatedState, 'attacker', 'target').state.combatants.target as any).dead).toBe(true);

        const minionState = createCombatState([
            createCombatantFromCharacter(character('minion', 'Minion', { wounds: 0, isMinion: true }), {
                side: 'adversary',
                currentWounds: 0,
            }),
            createCombatantFromCharacter(character('pc', 'PC', { wounds: 0, userId: 'user-1', isMinion: true }), {
                side: 'ally',
                currentWounds: 0,
            }),
        ]);
        expect((applySuddenDeathAtZero(minionState, 'minion', true).state.combatants.minion as any).dead).toBe(true);
        expect((applySuddenDeathAtZero(minionState, 'pc', true).state.combatants.pc as any).dead).toBeUndefined();
    });

    it('routes defender critical wounds to the attacker', () => {
        const result = resolveMeleeAttack(createCombatState([
            createCombatantFromCharacter(character('attacker', 'Attacker', { weaponSkill: 30 }), { side: 'ally' }),
            createCombatantFromCharacter(character('defender', 'Defender', { weaponSkill: 50 }), { side: 'adversary' }),
        ]), {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90, weaponDamage: 4 },
            defender: { skillId: 'melee_basic', targetNumber: 50, rollResult: 11 },
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'CritRolled',
            data: expect.objectContaining({ combatantId: 'attacker', role: 'target' }),
        }));
    });

    it('exercises 3e crit hook stubs', () => {
        const calls: string[] = [];
        const hooks: Partial<MeleeResolutionHooks> = {
            critTriggerExtensions: () => {
                calls.push('critTriggerExtensions');
                return true;
            },
            critIgnoreConditions: () => {
                calls.push('critIgnoreConditions');
                return false;
            },
            critApModifiers: () => {
                calls.push('critApModifiers');
                return 0;
            },
            onCritEffects: () => {
                calls.push('onCritEffects');
                return [];
            },
            critResolver: ctx => [{
                type: 'CritRolled',
                i18nKey: 'combat.critical.roll',
                data: { combatantId: ctx.combatantId, trigger: ctx.trigger, critRoll: 1 },
            }],
        };

        resolveMeleeAttack(createCombatState([
            createCombatantFromCharacter(character('attacker', 'Attacker', { weaponSkill: 50 }), { side: 'ally' }),
            createCombatantFromCharacter(character('defender', 'Defender', { weaponSkill: 20 }), { side: 'adversary' }),
        ]), {
            attackerId: 'attacker',
            defenderId: 'defender',
            hooks,
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 20, weaponDamage: 4 },
            defender: { skillId: 'melee_basic', targetNumber: 20, rollResult: 90 },
        });

        expect(calls).toEqual(expect.arrayContaining([
            'critTriggerExtensions',
            'critIgnoreConditions',
            'critApModifiers',
            'onCritEffects',
        ]));
    });
});

function stateWithTarget(options: CharacterOptions = {}): CombatState {
    return createCombatState([
        createCombatantFromCharacter(character('attacker', 'Attacker'), { side: 'ally' }),
        createCombatantFromCharacter(character('target', 'Target', options), {
            side: 'adversary',
            currentWounds: options.wounds ?? 12,
        }),
    ]);
}

function context(state: CombatState, options: Partial<CritResolverContext> = {}): CritResolverContext {
    return {
        state,
        action: {
            attackerId: 'attacker',
            defenderId: 'target',
            attacker: { skillId: 'melee_basic', targetNumber: 50 },
            defender: { skillId: 'melee_basic', targetNumber: 30 },
        },
        attacker: state.combatants.attacker,
        defender: state.combatants.target,
        attackerRoll: {
            skillId: 'melee_basic',
            rollResult: 11,
            targetNumber: 50,
            successLevel: 4,
            roundedSuccessLevel: 4,
            usedTalents: [],
        },
        hitLocation: 'Body',
        weaponDamage: 8,
        attackerSuccessLevel: 4,
        armourPoints: 0,
        damageDealt: 0,
        woundsBefore: state.combatants.target.currentWounds,
        woundsAfter: state.combatants.target.currentWounds,
        trigger: 'roll',
        combatantId: 'target',
        role: 'target',
        ...options,
    };
}

interface CharacterOptions {
    weaponSkill?: number;
    toughness?: number;
    wounds?: number;
    userId?: string | null;
    isMinion?: boolean;
}

function character(id: string, name: string, options: CharacterOptions = {}): Character {
    const wounds = options.wounds ?? 12;
    return {
        id,
        name,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: 'warrior',
        currentCareerLevelId: 'warrior-1',
        userId: options.userId ?? null,
        tags: [],
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '',
            height: '',
            hair: '',
            eyes: '',
            partyName: '',
            shortTermAmbition: '',
            longTermAmbition: '',
            partyShortTermAmbition: '',
            partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(options.weaponSkill ?? 40),
            bs: characteristic(30),
            s: characteristic(40),
            t: characteristic(options.toughness ?? 30),
            i: characteristic(30),
            ag: characteristic(30),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [],
        status: {
            wounds: { current: wounds, max: wounds },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: { weapons: {}, armor: {}, items: {} },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
        isMinion: options.isMinion,
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
