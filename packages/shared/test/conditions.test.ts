import { describe, expect, it } from 'vitest';
import type { Character, Characteristic } from '../src/types/wfrp.types';
import { createCombatantFromCharacter, createCombatState, resolveMeleeAttack } from '../src/combat/engine';
import { createSeededRng, type Rng } from '../src/combat/rng';
import {
    applyConditionRemovalTest,
    applyEndOfRoundConditionEffects,
    applyEndOfTurnConditionEffects,
    attackerModifiersFor,
    canRegainConsciousness,
    combatantCapabilities,
    conditionsRemovedAfterAttack,
    effectivePenalty,
    opposedTestCollapseFor,
} from '../src/utils/conditions';

describe('condition effects engine', () => {
    it('stacks identical condition penalties, then keeps only the worst different-condition penalty', () => {
        expect(effectivePenalty({ conditions: ['condition_fatigued', 'condition_fatigued', 'condition_stunned'] }, 'all')).toBe(-20);
        expect(effectivePenalty({ conditions: ['condition_blinded', 'condition_blinded', 'condition_fatigued'] }, 'sight')).toBe(-20);
        expect(effectivePenalty({ conditions: ['condition_prone', 'condition_prone', 'condition_entangled'] }, 'movement')).toBe(-20);
        expect(effectivePenalty({ conditions: ['condition_blinded', 'condition_deafened'] }, 'hearing')).toBe(-10);
        expect(effectivePenalty({ conditions: ['condition_blinded', 'condition_deafened'] }, 'all')).toBe(0);
        expect(effectivePenalty({ conditions: ['condition_broken'] }, { category: 'all', tags: ['running'] })).toBe(0);
    });

    it('reports attacker modifiers without the old Deafened facing bonus', () => {
        const modifiers = attackerModifiersFor({
            conditions: ['condition_blinded', 'condition_prone', 'condition_surprised', 'condition_stunned', 'condition_deafened'],
        });

        expect(modifiers.toHitModifier).toBe(50);
        expect(modifiers.advantageToAttacker).toBe(1);
        expect(modifiers.sources.map(source => source.conditionId)).not.toContain('condition_deafened');
    });

    it('exposes collapsed defence modes for Surprised and Unconscious defenders', () => {
        expect(opposedTestCollapseFor({ conditions: ['condition_surprised'] })).toMatchObject({
            mode: 'unopposed',
            canDefend: false,
            reason: 'condition_surprised',
        });

        expect(opposedTestCollapseFor({ conditions: ['condition_unconscious'] }, {
            attackTargetNumber: 55,
            chosenHitLocation: 'Head',
        })).toMatchObject({
            mode: 'autoHit',
            canDefend: false,
            reason: 'condition_unconscious',
            autoCritical: true,
            maxSuccessLevel: 5,
            hitLocation: 'Head',
        });
    });

    it('summarizes turn capabilities from restrictive conditions', () => {
        expect(combatantCapabilities({ conditions: ['condition_stunned'] })).toMatchObject({
            canAct: false,
            canMove: true,
            canDefend: true,
            halfMove: true,
        });
        expect(combatantCapabilities({ conditions: ['condition_surprised'] })).toMatchObject({
            canAct: false,
            canMove: false,
            canDefend: false,
        });
        expect(combatantCapabilities({ conditions: ['condition_entangled'] })).toMatchObject({
            canMove: false,
            movementPenalty: -10,
        });
        expect(combatantCapabilities({ conditions: ['condition_prone'] })).toMatchObject({
            canMove: true,
            moveRestriction: 'standOrCrawl',
            movementPenalty: -20,
        });
        expect(combatantCapabilities({ conditions: ['condition_broken'] })).toMatchObject({
            mustFlee: true,
            moveRestriction: 'flee',
            actionRestriction: 'flee',
        });
        expect(combatantCapabilities({ conditions: ['condition_unconscious', 'condition_bleeding'] })).toMatchObject({
            canTakeTurn: false,
            canDefend: false,
            blocksRegainingConsciousness: true,
        });
        expect(canRegainConsciousness({ conditions: ['condition_unconscious', 'condition_bleeding'] })).toBe(false);
        expect(canRegainConsciousness({ conditions: ['condition_unconscious'] })).toBe(true);
    });

    it('applies deterministic end-of-round damage for Ablaze, Bleeding, and Poisoned', () => {
        const result = applyEndOfRoundConditionEffects({
            name: 'Target',
            currentWounds: 12,
            conditions: ['condition_ablaze', 'condition_ablaze', 'condition_ablaze', 'condition_bleeding', 'condition_poisoned'],
        }, 1, undefined, {
            rng: fixedRng([0.7]),
            toughnessBonus: 3,
            armourPoints: 2,
        });

        expect(result.combatant.currentWounds).toBe(5);
        expect(result.events.filter(event => event.type === 'ConditionDamage').map(event => event.data)).toEqual([
            expect.objectContaining({ conditionId: 'condition_ablaze', damage: 5, baseDamage: 8, extraDamage: 2 }),
            expect.objectContaining({ conditionId: 'condition_bleeding', damage: 1, ignoresModifiers: true }),
            expect.objectContaining({ conditionId: 'condition_poisoned', damage: 1, ignoresModifiers: true }),
        ]);
    });

    it('uses seeded Bleeding death rolls and clots doubles instead of killing', () => {
        const clotted = applyEndOfRoundConditionEffects({
            name: 'Bleeder',
            currentWounds: 0,
            conditions: ['condition_bleeding', 'condition_bleeding', 'condition_unconscious'],
        }, 3, undefined, { rng: fixedRng([0.10]) });

        expect(clotted.dead).toBeUndefined();
        expect(clotted.conditionsToRemove).toEqual(['condition_bleeding']);
        expect(clotted.combatant.conditions).toEqual(['condition_bleeding', 'condition_unconscious']);
        expect(clotted.events.map(event => event.type)).toContain('ConditionClotted');

        const dead = applyEndOfRoundConditionEffects({
            name: 'Bleeder',
            currentWounds: 0,
            conditions: ['condition_bleeding', 'condition_bleeding', 'condition_unconscious'],
        }, 3, undefined, { rng: fixedRng([0.04]) });

        expect(dead.dead).toBe(true);
        expect(dead.events).toContainEqual(expect.objectContaining({
            type: 'ConditionDeath',
            data: expect.objectContaining({ conditionId: 'condition_bleeding', roll: 5, deathChance: 20 }),
        }));
    });

    it('handles Poisoned removal, pending unconscious poison tests, and Fatigued chains', () => {
        const removed = applyEndOfRoundConditionEffects({
            name: 'Poisoned',
            currentWounds: 3,
            conditions: ['condition_poisoned', 'condition_poisoned'],
        }, 2, undefined, {
            conditionRemovalTests: {
                condition_poisoned: { successLevel: 1 },
            },
        });

        expect(removed.combatant.currentWounds).toBe(2);
        expect(removed.conditionsToRemove).toEqual(['condition_poisoned', 'condition_poisoned']);
        expect(removed.conditionsToAdd).toEqual(['condition_fatigued']);
        expect(removed.combatant.conditions).toEqual(['condition_fatigued']);

        const pending = applyEndOfRoundConditionEffects({
            name: 'Poisoned',
            currentWounds: 1,
            conditions: ['condition_poisoned', 'condition_unconscious'],
            conditionInstances: [{ id: 'condition_unconscious', roundApplied: 1 }],
            character: makeCharacter('poisoned', 'Poisoned', { toughness: 20 }),
        }, 3);

        expect(pending.pendingTests).toContainEqual(expect.objectContaining({
            conditionId: 'condition_poisoned',
            testType: 'Endurance',
            reason: 'unconsciousPoisoned',
        }));
        expect(pending.pendingTests).toContainEqual(expect.objectContaining({
            conditionId: 'condition_poisoned',
            testType: 'Endurance',
            reason: 'endOfRound',
        }));
    });

    it('applies removal timers, end-of-turn Bleeding tests, and removal chains', () => {
        const timed = applyEndOfRoundConditionEffects({
            name: 'Timed',
            currentWounds: 10,
            conditions: ['condition_blinded', 'condition_blinded', 'condition_surprised'],
            conditionInstances: [
                { id: 'condition_blinded', roundApplied: 0 },
                { id: 'condition_blinded', roundApplied: 0 },
                { id: 'condition_surprised', roundApplied: 2 },
            ],
        }, 2);

        expect(timed.conditionsToRemove).toEqual(['condition_blinded', 'condition_surprised']);
        expect(timed.combatant.conditions).toEqual(['condition_blinded']);
        expect(conditionsRemovedAfterAttack({ conditions: ['condition_surprised'] })).toEqual(['condition_surprised']);

        const failedBleedingTest = applyEndOfTurnConditionEffects({
            name: 'Bleeding',
            currentWounds: 5,
            conditions: ['condition_bleeding'],
        }, { enduranceTest: { successLevel: -1 } });
        expect(failedBleedingTest.conditionsToAdd).toEqual(['condition_unconscious']);

        const stunnedRemoval = applyConditionRemovalTest({
            name: 'Stunned',
            conditions: ['condition_stunned', 'condition_stunned'],
        }, 'condition_stunned', { successLevel: 1 });
        expect(stunnedRemoval.combatant.conditions).toEqual(['condition_fatigued']);

        const bleedingRemoval = applyConditionRemovalTest({
            name: 'Bleeding',
            conditions: ['condition_bleeding'],
        }, 'condition_bleeding', { successLevel: 0 });
        expect(bleedingRemoval.combatant.conditions).toEqual(['condition_fatigued']);

        const unconsciousRemoval = applyConditionRemovalTest({
            name: 'Unconscious',
            conditions: ['condition_unconscious'],
        }, 'condition_unconscious', { successLevel: 0 });
        expect(unconsciousRemoval.combatant.conditions).toEqual(['condition_prone', 'condition_fatigued']);
    });

    it('feeds attacker condition modifiers into melee resolution', () => {
        const attacker = makeCharacter('attacker', 'Attacker', { weaponSkill: 40 });
        const defender = makeCharacter('defender', 'Defender', { weaponSkill: 40, toughness: 30 });
        const state = createCombatState([
            createCombatantFromCharacter(attacker, { side: 'ally' }),
            createCombatantFromCharacter(defender, {
                side: 'adversary',
                conditions: ['condition_blinded', 'condition_prone', 'condition_stunned'],
            }),
        ]);

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 60, weaponDamage: 7 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 90 },
        });

        expect(result.events[0]).toMatchObject({
            type: 'AdvantageChanged',
            data: { side: 'ally', delta: 1, reason: 'condition', sourceCombatantId: 'defender' },
        });
        expect(result.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: {
                attackerRoll: { targetNumber: 70 },
            },
        });
    });

    it('keeps condition outcomes identical for identical seeds', () => {
        const run = () => applyEndOfRoundConditionEffects({
            name: 'Seeded',
            currentWounds: 8,
            conditions: ['condition_ablaze', 'condition_ablaze', 'condition_bleeding', 'condition_unconscious'],
        }, 4, undefined, {
            rng: createSeededRng('condition-seed'),
            toughnessBonus: 3,
            armourPoints: 1,
        });

        expect(run()).toEqual(run());
    });
});

function fixedRng(values: number[]): Rng {
    const remaining = [...values];
    return {
        next: () => {
            const next = remaining.shift();
            if (next === undefined) throw new Error('No fixed RNG values left');
            return next;
        },
    };
}

function makeCharacter(id: string, name: string, options: {
    weaponSkill?: number;
    toughness?: number;
} = {}): Character {
    return {
        id,
        name,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: 'warrior',
        currentCareerLevelId: 'warrior-1',
        userId: null,
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
            wounds: { current: 12, max: 12 },
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
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
