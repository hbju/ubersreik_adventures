import { describe, expect, it } from 'vitest';
import type { Armor, Character, Characteristic, Weapon } from '../src/types/wfrp.types';
import { createCombatantFromCharacter, createCombatState, decayEngagementsEndOfRound, determineSurprise, initiativeOrder, resolveDamage, resolveMeleeAttack } from '../src/combat/engine';
import { createSeededRng, type Rng } from '../src/combat/rng';
import { engage } from '../src/combat/spatial';
import { collectMeleePreRollModifiers, resolveModifierTotal, sizeDifferenceModifier } from '../src/combat/modifiers';
import type { MeleeResolutionHooks } from '../src/combat/types';

const spear: Weapon = {
    id: 'spear',
    name: 'Spear',
    group: 'polearm',
    price: '1 GC',
    enc: 2,
    reach: 'Very Long',
    damage: '+SB+4',
    qualities: [],
    availability: 'Common',
};

const dagger: Weapon = {
    id: 'dagger',
    name: 'Dagger',
    group: 'basic',
    price: '16 S',
    enc: 0,
    reach: 'Very Short',
    damage: '+SB+2',
    qualities: [],
    availability: 'Common',
};

const club: Weapon = {
    id: 'club',
    name: 'Club',
    group: 'basic',
    price: '4 S',
    enc: 0,
    reach: 'Average',
    damage: '+SB+4',
    qualities: ['Undamaging'],
    availability: 'Common',
};

const bodyMail: Armor = {
    id: 'body-mail',
    name: 'Body Mail',
    price: '0 GC',
    enc: 2,
    availability: 'Common',
    type: 'Mail',
    penalty: '',
    locations: ['Body'],
    ap: 2,
    qualities: [],
};

describe('core melee resolution flow', () => {
    it('caps bonuses and penalties separately, then sums them', () => {
        const total = resolveModifierTotal([
            { id: 'snow', type: 'manual', phase: 'preRollModifiers', value: -40 },
            { id: 'prone', type: 'condition', phase: 'preRollModifiers', value: 20 },
            { id: 'assist', type: 'manual', phase: 'preRollModifiers', value: 70 },
        ]);

        expect(resolveModifierTotal(total.sources.slice(0, 2))).toMatchObject({
            cappedPenalty: -30,
            cappedBonus: 20,
            total: -10,
        });
        expect(total).toMatchObject({
            cappedPenalty: -30,
            cappedBonus: 60,
            total: 30,
        });
    });

    it('collects melee modifier sources for outnumbering, Prone, weapon length, size, and charging', () => {
        let state = createCombatState([
            combatant('attacker', 'Attacker', { side: 'ally', weapons: { [dagger.id]: 1 }, equippedWeapons: { [dagger.id]: true } }),
            combatant('helper', 'Helper', { side: 'ally' }),
            combatant('defender', 'Defender', {
                side: 'adversary',
                conditions: ['condition_prone'],
                weapons: { [spear.id]: 1 },
                equippedWeapons: { [spear.id]: true },
                tags: ['size:large'],
            }),
        ], { weapons: [dagger, spear] });
        state = engage(state, 'helper', 'defender').state;

        const sources = collectMeleePreRollModifiers(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            isCharging: true,
            attackerSize: 'average',
            defenderSize: 'large',
            attacker: { skillId: 'melee_basic', targetNumber: 40 },
            defender: { skillId: 'melee_basic', targetNumber: 40 },
        }, state.combatants.attacker, state.combatants.defender);

        expect(sources).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'condition:condition_prone', value: 20 }),
            expect.objectContaining({ id: 'outnumbering', value: 20 }),
            expect.objectContaining({ id: 'weaponLength:shorterAttacker', value: -10 }),
            expect.objectContaining({ id: 'size:difference', value: 20 }),
            expect.objectContaining({ id: 'charging:firstMeleeTest', value: 10 }),
            expect.objectContaining({ id: 'range:empty', value: 0 }),
        ]));
        expect(sizeDifferenceModifier('average', 'monstrous')).toBe(60);
        expect(sizeDifferenceModifier('average', 'tiny')).toBe(-30);
    });

    it('resolves a full seeded melee exchange deterministically', () => {
        const run = () => {
            const state = createCombatState([
                combatant('attacker', 'Attacker', { side: 'ally', weaponSkill: 55, strength: 40, weapons: { [spear.id]: 1 }, equippedWeapons: { [spear.id]: true } }),
                combatant('defender', 'Defender', { side: 'adversary', weaponSkill: 35, toughness: 30, wounds: 12 }),
            ], { weapons: [spear] });

            return resolveMeleeAttack(state, {
                attackerId: 'attacker',
                defenderId: 'defender',
                attacker: { skillId: 'melee_basic', targetNumber: 55, weaponId: spear.id, rollResult: 20 },
                defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 80 },
            }, createSeededRng('pbi-3c-melee'));
        };

        const first = run();
        expect(run()).toEqual(first);
        expect(first.events.map(event => event.type)).toContain('AttackResolved');
        expect(first.events.map(event => event.type)).toContain('DamageDealt');
        expect(first.events.find(event => event.type === 'AdvantageChanged')).toMatchObject({
            data: { side: 'ally', reason: 'opposedTestWin' },
        });
    });

    it('branches defence skills for Melee crit eligibility and avoid-only defences', () => {
        const melee = resolveMeleeAttack(testState(), attack({
            attackerRoll: 90,
            defenderSkill: 'melee_basic',
            defenderRoll: 11,
        }));
        expect(melee.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { outcome: 'defender', defenderCanCrit: true, defenderAvoidsOnly: false },
        });
        expect(melee.events).toContainEqual(expect.objectContaining({ type: 'CritRolled', data: expect.objectContaining({ combatantId: 'attacker', role: 'target' }) }));

        const dodge = resolveMeleeAttack(testState(), attack({
            attackerRoll: 90,
            defenderSkill: 'dodge',
            defenderRoll: 11,
        }));
        expect(dodge.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { outcome: 'defender', defenderCanCrit: false, defenderAvoidsOnly: true },
        });
        expect(dodge.events).not.toContainEqual(expect.objectContaining({ type: 'CritRolled', data: expect.objectContaining({ combatantId: 'attacker' }) }));

        const other = resolveMeleeAttack(testState(), attack({
            attackerRoll: 90,
            defenderSkill: 'athletics',
            defenderRoll: 11,
        }));
        expect(other.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { defenderCanCrit: false, defenderAvoidsOnly: true },
        });
    });

    it('applies minimum 1 Wound and the Undamaging disable path', () => {
        const state = createCombatState([
            combatant('attacker', 'Attacker', { side: 'ally' }),
            combatant('defender', 'Defender', { side: 'adversary', toughness: 40, wounds: 10, armor: { [bodyMail.id]: 1 }, equippedArmor: { [bodyMail.id]: true } }),
        ], { armor: [bodyMail] });

        const minimum = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_basic',
            weaponDamage: 4,
            slDifference: 0,
            sl: 0,
            hitLocation: 'Body',
        });
        expect(minimum.events[0]).toMatchObject({
            data: { damageDealt: 1, minimumOneWoundApplied: true, woundsAfter: 9 },
        });

        const disabled = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_basic',
            weaponDamage: 4,
            slDifference: 0,
            sl: 0,
            hitLocation: 'Body',
            disableMinimumWound: true,
        });
        expect(disabled.events[0]).toMatchObject({
            data: { damageDealt: 0, minimumOneWoundApplied: false, woundsAfter: 10 },
        });
    });

    it('delegates roll, zero-wounds, and unconscious auto-hit crit triggers', () => {
        const triggers: string[] = [];
        const hooks: Partial<MeleeResolutionHooks> = {
            critResolver: context => {
                triggers.push(context.trigger);
                return [{
                    type: 'CritRolled',
                    i18nKey: 'combat.critical.roll',
                    data: {
                        combatantId: context.combatantId,
                        role: context.role,
                        trigger: context.trigger,
                        critRoll: 42,
                        hitLocation: context.hitLocation,
                        woundsBeyondZero: context.woundsBeyondZero,
                    },
                }];
            },
        };

        resolveMeleeAttack(testState({ defenderWounds: 2 }), attack({
            attackerRoll: 11,
            defenderRoll: 99,
            hooks,
        }));
        resolveMeleeAttack(testState({ defenderWounds: 2 }), attack({
            attackerRoll: 20,
            defenderRoll: 99,
            weaponDamage: 10,
            hooks,
        }));
        resolveMeleeAttack(testState({ defenderConditions: ['condition_unconscious'] }), attack({
            attackerRoll: 90,
            defenderRoll: 10,
            chosenHitLocation: 'Head',
            hooks,
        }));

        expect(triggers).toEqual(expect.arrayContaining(['roll', 'zeroWounds', 'unconsciousAuto']));
    });

    it('resolves fumbles even when the fumbling attacker still wins by SL', () => {
        const result = resolveMeleeAttack(testState(), attack({
            attackerRoll: 99,
            attackerTarget: 40,
            defenderRoll: 100,
            defenderTarget: 20,
        }), fixedRng([0.01]));

        expect(result.events).toContainEqual(expect.objectContaining({
            type: 'FumbleResolved',
            data: expect.objectContaining({ effect: 'wounds_minus_1' }),
        }));
        expect(result.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { outcome: 'attacker' },
        });
    });

    it('applies charge +10, charge Advantage, attack-driven engagement, and decay', () => {
        const state = testState();
        const result = resolveMeleeAttack(state, attack({
            attackerRoll: 50,
            defenderRoll: 80,
            isCharging: true,
        }));

        expect(result.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { attackerRoll: { targetNumber: 60 } },
        });
        expect(result.events.filter(event => event.type === 'AdvantageChanged')).toEqual(expect.arrayContaining([
            expect.objectContaining({ data: expect.objectContaining({ side: 'ally', delta: 1 }) }),
        ]));
        expect(result.state.combatants.attacker.engagementIds).toContain('defender');
        expect(result.state.engagements['attacker::defender']).toMatchObject({ lastAttackRound: 0 });

        const decayed = decayEngagementsEndOfRound({ ...result.state, round: 1 });
        expect(decayed.state.combatants.attacker.engagementIds).toEqual([]);
        expect(decayed.state.engagements).toEqual({});
    });

    it('provides initiative and surprise pure helpers', () => {
        const ordered = initiativeOrder([
            combatant('slow', 'Slow', { agility: 20 }),
            combatant('fast', 'Fast', { agility: 40 }),
        ], fixedRng([0.0, 0.0]));

        expect(ordered.map(entry => entry.combatant.id)).toEqual(['fast', 'slow']);
        expect(determineSurprise([
            { id: 'a', conditions: [] },
            { id: 'b', conditions: [] },
        ], { surprisedIds: ['b'] })).toEqual([
            { id: 'a', conditions: [] },
            { id: 'b', conditions: ['condition_surprised'] },
        ]);
    });
});

function testState(options: { defenderWounds?: number; defenderConditions?: string[] } = {}) {
    return createCombatState([
        combatant('attacker', 'Attacker', { side: 'ally', weaponSkill: 50, strength: 40, weapons: { [club.id]: 1 }, equippedWeapons: { [club.id]: true } }),
        combatant('defender', 'Defender', { side: 'adversary', weaponSkill: 40, toughness: 30, wounds: options.defenderWounds ?? 12, conditions: options.defenderConditions ?? [] }),
    ], { weapons: [club] });
}

function attack(options: {
    attackerRoll: number;
    defenderRoll: number;
    attackerTarget?: number;
    defenderTarget?: number;
    defenderSkill?: string;
    weaponDamage?: number;
    isCharging?: boolean;
    chosenHitLocation?: string;
    hooks?: Partial<MeleeResolutionHooks>;
}) {
    return {
        attackerId: 'attacker',
        defenderId: 'defender',
        isCharging: options.isCharging,
        chosenHitLocation: options.chosenHitLocation,
        hooks: options.hooks,
        attacker: {
            skillId: 'melee_basic',
            targetNumber: options.attackerTarget ?? 50,
            rollResult: options.attackerRoll,
            weaponId: club.id,
            weaponDamage: options.weaponDamage,
        },
        defender: {
            skillId: options.defenderSkill ?? 'melee_basic',
            targetNumber: options.defenderTarget ?? 40,
            rollResult: options.defenderRoll,
        },
    };
}

function combatant(id: string, name: string, options: CharacterOptions & { side?: 'ally' | 'adversary' } = {}) {
    return createCombatantFromCharacter(makeCharacter(id, name, options), {
        side: options.side ?? 'ally',
        conditions: options.conditions,
    });
}

interface CharacterOptions {
    weaponSkill?: number;
    strength?: number;
    toughness?: number;
    agility?: number;
    wounds?: number;
    conditions?: string[];
    tags?: string[];
    weapons?: Record<string, number>;
    equippedWeapons?: Record<string, boolean>;
    armor?: Record<string, number>;
    equippedArmor?: Record<string, boolean>;
}

function makeCharacter(id: string, name: string, options: CharacterOptions = {}): Character {
    const wounds = options.wounds ?? 12;
    return {
        id,
        name,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: 'warrior',
        currentCareerLevelId: 'warrior-1',
        userId: null,
        tags: options.tags ?? [],
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
            s: characteristic(options.strength ?? 40),
            t: characteristic(options.toughness ?? 30),
            i: characteristic(30),
            ag: characteristic(options.agility ?? 30),
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
        inventory: {
            weapons: options.weapons ?? {},
            armor: options.armor ?? {},
            items: {},
            equippedWeapons: options.equippedWeapons ?? {},
            equippedArmor: options.equippedArmor ?? {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}

function fixedRng(values: number[]): Rng {
    const remaining = [...values];
    return {
        next: () => {
            const next = remaining.shift();
            if (next === undefined) return 0;
            return next;
        },
    };
}
