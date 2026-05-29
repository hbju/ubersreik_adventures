import { describe, expect, it } from 'vitest';
import type { Armor, Character, Characteristic } from '../src/types/wfrp.types';
import { createCombatantFromCharacter, createCombatState, getArmorPointsAtLocation, resolveDamage, resolveMeleeAttack } from '../src/combat/engine';
import { createSeededRng } from '../src/combat/rng';
import { rolld100, rollDice } from '../src/utils/mechanics';

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

const bodyLeather: Armor = {
    id: 'body-leather',
    name: 'Body Leather',
    price: '0 GC',
    enc: 1,
    availability: 'Common',
    type: 'Soft Leather',
    penalty: '',
    locations: ['Torso'],
    ap: 1,
    qualities: [],
};

describe('combat engine', () => {
    it('produces a known deterministic dice sequence from a seed', () => {
        const rng = createSeededRng('combat-golden');

        expect([
            rolld100(rng),
            rollDice(2, 10, rng),
            rolld100(rng),
            rolld100(rng),
            rolld100(rng),
        ]).toEqual([84, 11, 76, 75, 100]);
    });

    it('applies SL damage, toughness bonus, and stacked AP at the hit location', () => {
        const attacker = makeCharacter('attacker', 'Attacker', { strength: 40 });
        const defender = makeCharacter('defender', 'Defender', {
            toughness: 35,
            wounds: 10,
            armor: { 'body-mail': 1, 'body-leather': 1 },
            equippedArmor: { 'body-mail': true, 'body-leather': true },
        });
        const state = createCombatState([
            createCombatantFromCharacter(attacker),
            createCombatantFromCharacter(defender),
        ], { armor: [bodyMail, bodyLeather] });

        const result = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_basic',
            slDifference: 2,
            weaponDamage: 8,
            hitLocation: 'Body',
        });

        expect(getArmorPointsAtLocation(defender, 'Body', [bodyMail, bodyLeather])).toBe(3);
        expect(result.events[0]).toMatchObject({
            type: 'DamageDealt',
            i18nKey: 'combat.damage.dealt',
            data: {
                rawDamage: 10,
                toughnessBonus: 3,
                armourPoints: 3,
                damageDealt: 4,
                woundsBefore: 10,
                woundsAfter: 6,
            },
        });
        expect(result.state.combatants.defender.currentWounds).toBe(6);
        expect(state.combatants.defender.currentWounds).toBe(10);
    });

    it('floors damage at zero across low SL boundaries', () => {
        const attacker = makeCharacter('attacker', 'Attacker');
        const defender = makeCharacter('defender', 'Defender', {
            toughness: 35,
            wounds: 10,
            armor: { 'body-mail': 1 },
            equippedArmor: { 'body-mail': true },
        });
        const state = createCombatState([
            createCombatantFromCharacter(attacker),
            createCombatantFromCharacter(defender),
        ], { armor: [bodyMail] });

        const result = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_basic',
            slDifference: 1,
            weaponDamage: 4,
            hitLocation: 'Body',
        });

        expect(result.events[0]).toMatchObject({
            type: 'DamageDealt',
            data: {
                rawDamage: 5,
                toughnessBonus: 3,
                armourPoints: 2,
                damageDealt: 0,
                woundsAfter: 10,
            },
        });
    });

    it('emits a seeded zero-wounds critical without mutating the input state', () => {
        const attacker = makeCharacter('attacker', 'Attacker');
        const defender = makeCharacter('defender', 'Defender', { toughness: 30, wounds: 3 });
        const state = createCombatState([
            createCombatantFromCharacter(attacker),
            createCombatantFromCharacter(defender),
        ]);

        const result = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_basic',
            slDifference: 1,
            weaponDamage: 5,
            hitLocation: 'Body',
        }, createSeededRng('zero-wounds'));

        expect(result.events.map(event => event.type)).toEqual(['DamageDealt', 'CritRolled']);
        expect(result.events[1]).toMatchObject({
            type: 'CritRolled',
            i18nKey: 'combat.critical.zeroWounds',
            data: {
                combatantId: 'defender',
                trigger: 'zeroWounds',
                critRoll: 48,
                hitLocation: 'Body',
            },
        });
        expect(result.state.combatants.defender.currentWounds).toBe(0);
        expect(state.combatants.defender.currentWounds).toBe(3);
    });

    it('resolves a fixed-seed melee attack to a known byte-stable outcome', () => {
        const first = resolveGoldenMelee();
        const second = resolveGoldenMelee();

        expect(second).toEqual(first);
        expect(first.events.map(event => event.type)).toEqual(['AttackResolved', 'DamageDealt', 'AdvantageChanged']);
        expect(first.events[0]).toMatchObject({
            type: 'AttackResolved',
            i18nKey: 'combat.attack.attacker',
            data: {
                outcome: 'attacker',
                slDifference: 0,
                hitLocation: 'Head',
                attackerRoll: {
                    rollResult: 80,
                    targetNumber: 55,
                    roundedSuccessLevel: -3,
                },
                defenderRoll: {
                    rollResult: 61,
                    targetNumber: 35,
                    roundedSuccessLevel: -3,
                },
            },
        });
        expect(first.events[1]).toMatchObject({
            type: 'DamageDealt',
            data: {
                hitLocation: 'Head',
                rawDamage: 8,
                toughnessBonus: 3,
                armourPoints: 0,
                damageDealt: 5,
                woundsAfter: 7,
            },
        });
        expect(first.events[2]).toMatchObject({
            type: 'AdvantageChanged',
            i18nKey: 'combat.advantage.changed',
            data: {
                side: 'adversary',
                delta: 1,
                poolBefore: 0,
                poolAfter: 1,
                total: 1,
                reason: 'opposedTestWin',
                sourceCombatantId: 'attacker',
            },
        });
        expect(first.state.combatants.defender.currentWounds).toBe(7);
        expect(first.state.advantagePools.adversary).toBe(1);
    });

    it('does not grant pool Advantage when generatesAdvantage is false', () => {
        const attacker = makeCharacter('attacker', 'Attacker', { weaponSkill: 55 });
        const defender = makeCharacter('defender', 'Defender', { weaponSkill: 35, toughness: 35, wounds: 12 });
        const state = createCombatState([
            createCombatantFromCharacter(attacker, { side: 'adversary' }),
            createCombatantFromCharacter(defender, { side: 'ally' }),
        ]);

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            generatesAdvantage: false,
            attacker: { skillId: 'melee_basic', targetNumber: 55, rollResult: 20, weaponDamage: 8 },
            defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 80 },
        });

        expect(result.events.map(event => event.type)).not.toContain('AdvantageChanged');
        expect(result.state.advantagePools).toEqual({ ally: 0, adversary: 0 });
    });
});

function resolveGoldenMelee() {
    const attacker = makeCharacter('attacker', 'Attacker', { weaponSkill: 55 });
    const defender = makeCharacter('defender', 'Defender', { weaponSkill: 35, toughness: 35, wounds: 12 });
    const state = createCombatState([
        createCombatantFromCharacter(attacker, { side: 'adversary' }),
        createCombatantFromCharacter(defender, { side: 'ally' }),
    ]);

    return resolveMeleeAttack(state, {
        attackerId: 'attacker',
        defenderId: 'defender',
        attacker: {
            skillId: 'melee_basic',
            targetNumber: 55,
            weaponDamage: 8,
        },
        defender: {
            skillId: 'melee_basic',
            targetNumber: 35,
        },
    }, createSeededRng('melee-golden'));
}

function makeCharacter(id: string, name: string, options: {
    weaponSkill?: number;
    strength?: number;
    toughness?: number;
    wounds?: number;
    armor?: Record<string, number>;
    equippedArmor?: Record<string, boolean>;
} = {}): Character {
    const wounds = options.wounds ?? 12;

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
            s: characteristic(options.strength ?? 40),
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
        inventory: {
            weapons: {},
            armor: options.armor ?? {},
            items: {},
            equippedArmor: options.equippedArmor ?? {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
