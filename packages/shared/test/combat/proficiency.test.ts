import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    RangedShotRejectedEvent,
    createCombatState,
    createCombatantFromCharacter,
    resolveMeleeAttack,
    resolveRangedAttack,
    resolveWeaponUse,
    weaponForUse,
} from '../../src/combat';

const sword: Weapon = weapon('sword', 'basic', '+SB+4', ['Damaging']);
const impreciseClub: Weapon = weapon('club', 'basic', '+SB+3', ['Imprecise']);
const flail: Weapon = weapon('flail', 'flail', '+SB+5', []);
const mainGauche: Weapon = weapon('main-gauche', 'parry', '+SB+2', ['Defensive']);
const accurateCrossbow: Weapon = weapon('crossbow', 'crossbow', '+9', ['Accurate', 'Reload 1']);
const engineeringGun: Weapon = weapon('engineering-gun', 'engineering', '+9', ['Accurate', 'Blackpowder']);
const blackpowderGun: Weapon = weapon('handgun', 'blackpowder', '+9', ['Accurate', 'Blackpowder']);
const bow: Weapon = weapon('bow', 'bow', '+8', ['Accurate']);
const cavalryLance: Weapon = weapon('lance', 'cavalry', '+SB+6', []);

describe('weapon proficiency', () => {
    it('uses skilled melee group tests and keeps qualities active', () => {
        const attacker = combatant('attacker', 'ally', ['sword'], [['melee_basic', 'Melee (Basic)', 'ws', 5]], 0);
        const defender = combatant('defender', 'adversary', [], [['melee_basic', 'Melee (Basic)', 'ws', 5]], 1);
        const state = createCombatState([attacker, defender], { weapons: [sword] });

        const result = resolveMeleeAttack(state, meleeAction('attacker', 'defender', 'sword', 29, 75, 80));
        const resolved = result.events.find(event => event.type === 'AttackResolved');

        expect(resolveWeaponUse(attacker, sword)).toMatchObject({ qualitiesActive: true, usable: true });
        expect(resolved?.data.attackerRoll.skillId).toBe('melee_basic');
        expect(result.events.find(event => event.type === 'DamageDealt')?.data.rawDamage).toBeGreaterThan(12);
    });

    it('falls unskilled melee back to WS, suppresses qualities, and keeps flaws', () => {
        const skilledDefender = combatant('defender', 'adversary', [], [['melee_basic', 'Melee (Basic)', 'ws', 5]], 1);
        const damagingAttacker = combatant('damaging', 'ally', ['sword'], [['melee_basic', 'Melee (Basic)', 'ws', 0]], 0);
        const flawedAttacker = combatant('flawed', 'ally', ['club'], [['melee_basic', 'Melee (Basic)', 'ws', 0]], 0);

        const damaging = resolveMeleeAttack(createCombatState([damagingAttacker, skilledDefender], { weapons: [sword] }), meleeAction('damaging', 'defender', 'sword', 24, 75, 80));
        const flawed = resolveMeleeAttack(createCombatState([flawedAttacker, skilledDefender], { weapons: [impreciseClub] }), meleeAction('flawed', 'defender', 'club', 24, 75, 80));

        expect(resolveWeaponUse(damagingAttacker, sword)).toMatchObject({ qualitiesActive: false, usable: true });
        expect(damaging.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.skillId).toBe('ws');
        expect(damaging.events.find(event => event.type === 'DamageDealt')?.data.rawDamage).toBe(12);
        expect(flawed.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.roundedSuccessLevel).toBe(4);
    });

    it('adds Dangerous for unskilled Flail use', () => {
        const attacker = combatant('attacker', 'ally', ['flail'], [['melee_flail', 'Melee (Flail)', 'ws', 0]], 0);
        const defender = combatant('defender', 'adversary', [], [['melee_basic', 'Melee (Basic)', 'ws', 5]], 1);
        const state = createCombatState([attacker, defender], { weapons: [flail] });

        const result = resolveMeleeAttack(state, meleeAction('attacker', 'defender', 'flail', 91, 30, 80));

        expect(resolveWeaponUse(attacker, flail).extraFlaws).toEqual(['Dangerous']);
        expect(result.events.some(event => event.type === 'FumbleRolled')).toBe(true);
    });

    it('lets Defensive parry weapons avoid the dual-wield defence penalty', () => {
        const attacker = combatant('attacker', 'ally', ['sword'], [['melee_basic', 'Melee (Basic)', 'ws', 5]], 0);
        const defender = {
            ...combatant('defender', 'adversary', ['sword', 'main-gauche'], [
                ['melee_basic', 'Melee (Basic)', 'ws', 5],
                ['melee_parry', 'Melee (Parry)', 'ws', 5],
            ], 1),
            dualWieldDefensivePenalty: true,
        };
        const state = createCombatState([attacker, defender], { weapons: [sword, mainGauche] });

        const result = resolveMeleeAttack(state, {
            ...meleeAction('attacker', 'defender', 'sword', 24, 60, 50),
            defender: { skillId: 'melee_parry', targetNumber: 50, rollResult: 35, weaponId: 'main-gauche' },
        });

        expect(result.events.find(event => event.type === 'AttackResolved')?.data.defenderRoll.targetNumber).toBe(50);
    });

    it('handles ranged specialty, fallback, cross-training, and hard blocks', () => {
        const target = combatant('target', 'adversary', [], [], 20);
        const skilled = combatant('skilled', 'ally', ['crossbow'], [['ranged_crossbow', 'Ranged (Crossbow)', 'bs', 5]], 0);
        const fallback = combatant('fallback', 'ally', ['crossbow'], [['ranged_crossbow', 'Ranged (Crossbow)', 'bs', 0]], 0);
        const blackpowderTrained = combatant('bp-trained', 'ally', ['engineering-gun'], [['ranged_blackpowder', 'Ranged (Blackpowder)', 'bs', 5]], 0);
        const engineeringTrained = combatant('eng-trained', 'ally', ['handgun'], [['ranged_engineering', 'Ranged (Engineering)', 'bs', 5]], 0);
        const blocked = combatant('blocked', 'ally', ['bow'], [['ranged_bow', 'Ranged (Bow)', 'bs', 0]], 0);

        const skilledShot = resolveRangedAttack(createCombatState([skilled, target], { weapons: [accurateCrossbow] }), rangedAction('skilled', 'target', 'crossbow', 60));
        const fallbackShot = resolveRangedAttack(createCombatState([fallback, target], { weapons: [accurateCrossbow] }), rangedAction('fallback', 'target', 'crossbow', 60));
        const engineeringFallback = resolveRangedAttack(createCombatState([blackpowderTrained, target], { weapons: [engineeringGun] }), rangedAction('bp-trained', 'target', 'engineering-gun', 60));
        const blackpowderFull = resolveRangedAttack(createCombatState([engineeringTrained, target], { weapons: [blackpowderGun] }), rangedAction('eng-trained', 'target', 'handgun', 60));
        const unusable = resolveRangedAttack(createCombatState([blocked, target], { weapons: [bow] }), rangedAction('blocked', 'target', 'bow', 60));

        expect(skilledShot.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.skillId).toBe('ranged_crossbow');
        expect(skilledShot.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.targetNumber).toBe(80);
        expect(fallbackShot.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.skillId).toBe('bs');
        expect(fallbackShot.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.targetNumber).toBe(70);
        expect(engineeringFallback.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.targetNumber).toBe(70);
        expect(blackpowderFull.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.targetNumber).toBe(80);
        expect(unusable.events[0].type).toBe('RangedShotRejected');
        expect((unusable.events[0] as RangedShotRejectedEvent).data.reason).toBe('weaponUnusable');
    });

    it('adds Two-Handed to unmounted two-handed Cavalry weapons', () => {
        const rider = combatant('rider', 'ally', ['lance'], [['melee_cavalry', 'Melee (Cavalry)', 'ws', 5]], 0);
        const use = resolveWeaponUse(rider, cavalryLance);
        expect(use).toMatchObject({ usable: true, qualitiesActive: true });
        expect(weaponForUse(cavalryLance, use).qualities).toContain('Two-Handed');
    });
});

function weapon(id: string, group: string, damage: string, qualities: string[] = []): Weapon {
    const reach = ['blackpowder', 'bow', 'crossbow', 'engineering', 'explosive', 'throwing'].includes(group) ? '50' : group === 'cavalry' ? 'Long' : 'Average';
    return { id, name: id, group, price: '1 GC', enc: 1, reach, damage, qualities, availability: 'Common' };
}

function meleeAction(attackerId: string, defenderId: string, weaponId: string, attackerRoll: number, attackerTarget: number, defenderTarget: number) {
    return {
        attackerId,
        defenderId,
        attacker: { skillId: 'melee_basic', targetNumber: attackerTarget, rollResult: attackerRoll, weaponId },
        defender: { skillId: 'melee_basic', targetNumber: defenderTarget, rollResult: 80 },
    };
}

function rangedAction(attackerId: string, defenderId: string, weaponId: string, rollResult: number) {
    return {
        attackerId,
        defenderId,
        distance: 20,
        attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult, weaponId },
    };
}

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], skillRows: Array<[string, string, string, number]>, position: number) {
    return createCombatantFromCharacter(characterFixture(id, weapons, skillRows), {
        id,
        side,
        position,
        weaponLoadout: { primaryWeaponId: weapons[0], secondaryWeaponId: weapons[1] },
    });
}

function characterFixture(id: string, weapons: string[], skillRows: Array<[string, string, string, number]>): Character {
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
            ...skillRows.map(([id, name, characteristic, advances]) => ({ id, name, characteristic, advances, talents: 0, modifier: 0 })),
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 18, max: 18 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: {
            weapons: Object.fromEntries(weapons.map(weapon => [weapon, 1])),
            armor: {},
            items: {},
            equippedWeapons: Object.fromEntries(weapons.map(weapon => [weapon, true])),
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
