import { describe, expect, it } from 'vitest';
import type { Armor, Character, Characteristic, Weapon } from '../src/types/wfrp.types';
import { createCombatantFromCharacter, createCombatState, getArmorPointsAtLocation, resolveMeleeAttack } from '../src/combat/engine';
import { qualityEffectRegistry } from '../src/combat/qualities';

describe('weapon qualities and flaws', () => {
    it('exposes registry entries and activation records', () => {
        expect(qualityEffectRegistry.trip[0].activation).toMatchObject({
            trigger: 'onHit',
            cost: { resource: 'advantage', amount: 2 },
            policy: 'never',
        });
        expect(qualityEffectRegistry.slash[0].activation).toMatchObject({ trigger: 'onCrit' });
    });

    it('resolves Improvised as Undamaging plus Unbalanced end-to-end', () => {
        const improvised = weapon('improvised', ['Undamaging', 'Unbalanced']);
        const armour = armor('leather', 1, ['Body'], []);
        const result = resolveMeleeAttack(state({ attackerWeapon: improvised, defenderArmor: armour }), attack({
            attackerRoll: 45,
            defenderRoll: 90,
        }));

        expect(result.events.find(event => event.type === 'DamageDealt')).toMatchObject({
            data: {
                rawDamage: 13,
                armourPoints: 2,
                damageDealt: 8,
                minimumOneWoundApplied: false,
            },
        });

        const defence = resolveMeleeAttack(state({ attackerWeapon: weapon('sword', []), defenderWeapon: improvised }), attack({
            attackerRoll: 90,
            defenderRoll: 20,
        }));
        expect(defence.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { defenderRoll: { roundedSuccessLevel: 0 } },
        });
    });

    it('stacks Damaging and Impact, blocked by Tiring unless charging', () => {
        const heavy = weapon('heavy', ['Damaging', 'Impact']);
        const tiring = weapon('tiring', ['Damaging', 'Impact', 'Tiring']);
        const normal = resolveMeleeAttack(state({ attackerWeapon: heavy }), attack({ attackerRoll: 48, defenderRoll: 99 }));
        const tired = resolveMeleeAttack(state({ attackerWeapon: tiring }), attack({ attackerRoll: 48, defenderRoll: 99 }));
        const charged = resolveMeleeAttack(state({ attackerWeapon: tiring }), attack({ attackerRoll: 48, defenderRoll: 99, isCharging: true }));

        expect(normal.events.find(event => event.type === 'DamageDealt')).toMatchObject({ data: { rawDamage: 22 } });
        expect(tired.events.find(event => event.type === 'DamageDealt')).toMatchObject({ data: { rawDamage: 13 } });
        expect(charged.events.find(event => event.type === 'DamageDealt')).toMatchObject({ data: { rawDamage: 22 } });
    });

    it('applies Penetrating, Shield, Defensive, and armour layering AP rules', () => {
        const plate = armor('plate', 2, ['Body'], ['Reinforced']);
        const mail = armor('mail', 2, ['Body'], ['Flexible']);
        const shield = weapon('shield', ['Shield 2', 'Defensive', 'Undamaging']);
        const result = resolveMeleeAttack(state({
            attackerWeapon: weapon('pick', ['Penetrating']),
            defenderWeapon: shield,
            defenderArmor: [plate, mail],
        }), attack({
            attackerRoll: 45,
            defenderRoll: 90,
        }));

        expect(getArmorPointsAtLocation(result.state.combatants.defender.character, 'Body', [plate, mail])).toBe(5);
        expect(result.events.find(event => event.type === 'DamageDealt')).toMatchObject({
            data: { armourPoints: 5 },
        });
    });

    it('runs Pummel, Entangle, Distract, and Trip on-hit effects', () => {
        const pummel = resolveMeleeAttack(state({ attackerWeapon: weapon('mace', ['Pummel']) }), attack({ attackerRoll: 10, defenderRoll: 99 }));
        expect(pummel.state.combatants.defender.conditions).toContain('condition_stunned');

        const entangle = resolveMeleeAttack(state({ attackerWeapon: weapon('net', ['Entangle']) }), attack({ attackerRoll: 20, defenderRoll: 99 }));
        expect(entangle.state.combatants.defender.conditions).toContain('condition_entangled');
        expect(entangle.events.some(event => event.type === 'DamageDealt')).toBe(false);

        const distract = resolveMeleeAttack(state({ attackerWeapon: weapon('whip', ['Distract']) }), attack({ attackerRoll: 20, defenderRoll: 99 }));
        expect(distract.state.combatants.defender.position).toBeGreaterThan(0);
        expect(distract.events.some(event => event.type === 'DamageDealt')).toBe(false);

        const trip = resolveMeleeAttack(state({ attackerWeapon: weapon('hook', ['Trip']) }), attack({ attackerRoll: 20, defenderRoll: 99 }));
        expect(trip.events).toContainEqual(expect.objectContaining({
            type: 'QualityEffectApplied',
            data: expect.objectContaining({ qualityId: 'trip', effect: 'activationAvailable' }),
        }));
    });

    it('fills crit hooks for Impale, Impenetrable, Weakpoints, Partial, and Slash', () => {
        const ignored = resolveMeleeAttack(state({
            attackerWeapon: weapon('spear', []),
            defenderArmor: armor('plate', 2, ['Arms'], ['Impenetrable']),
        }), attack({ attackerRoll: 11, defenderRoll: 99 }));
        expect(ignored.events.some(event => event.type === 'CritRolled')).toBe(false);

        const impale = resolveMeleeAttack(state({ attackerWeapon: weapon('spear', ['Impale', 'Slash 1']) }), attack({ attackerRoll: 20, defenderRoll: 99 }));
        expect(impale.events).toContainEqual(expect.objectContaining({ type: 'CritRolled' }));
        expect(impale.state.combatants.defender.conditions).toContain('condition_bleeding');

        expect(qualityEffectRegistry.weakpoints[0].phase).toBe('critApModifiers');
        expect(qualityEffectRegistry.partial[0].phase).toBe('critApModifiers');
    });

    it('extends fumble detection for Dangerous', () => {
        const result = resolveMeleeAttack(state({ attackerWeapon: weapon('dangerous', ['Dangerous']) }), attack({
            attackerRoll: 91,
            attackerTarget: 50,
            defenderRoll: 99,
            defenderTarget: 20,
        }));
        expect(result.events).toContainEqual(expect.objectContaining({ type: 'FumbleResolved' }));
    });

    it('applies Blackpowder pressure even on a miss', () => {
        const result = resolveMeleeAttack(state({ attackerWeapon: weapon('pistol', ['Blackpowder', 'Pistol']) }), attack({
            attackerRoll: 90,
            attackerTarget: 50,
            defenderRoll: 10,
        }));
        expect(result.state.combatants.defender.conditions).toContain('condition_broken');
    });
});

function state(options: {
    attackerWeapon?: Weapon;
    defenderWeapon?: Weapon;
    defenderArmor?: Armor | Armor[];
} = {}) {
    const attackerWeapon = { ...(options.attackerWeapon ?? weapon('sword', [])), id: 'attacker-weapon' };
    const defenderWeapon = { ...(options.defenderWeapon ?? weapon('dagger', [])), id: 'defender-weapon' };
    const defenderArmor = Array.isArray(options.defenderArmor)
        ? options.defenderArmor
        : options.defenderArmor ? [options.defenderArmor] : [];
    return createCombatState([
        createCombatantFromCharacter(character('attacker', 'Attacker', attackerWeapon), { side: 'ally' }),
        createCombatantFromCharacter(character('defender', 'Defender', defenderWeapon, defenderArmor), { side: 'adversary' }),
    ], { weapons: [attackerWeapon, defenderWeapon], armor: defenderArmor });
}

function attack(options: {
    attackerRoll: number;
    defenderRoll: number;
    attackerTarget?: number;
    defenderTarget?: number;
    isCharging?: boolean;
}) {
    return {
        attackerId: 'attacker',
        defenderId: 'defender',
        isCharging: options.isCharging,
        attacker: {
            skillId: 'melee_basic',
            targetNumber: options.attackerTarget ?? 50,
            rollResult: options.attackerRoll,
            weaponId: 'attacker-weapon',
            weaponDamage: 6,
        },
        defender: {
            skillId: 'melee_basic',
            targetNumber: options.defenderTarget ?? 30,
            rollResult: options.defenderRoll,
            weaponId: 'defender-weapon',
        },
    };
}

function weapon(id: string, qualities: string[]): Weapon {
    return {
        id: id === 'attacker-weapon' || id === 'defender-weapon' ? id : id.includes('defender') ? id : id,
        name: id,
        group: 'basic',
        price: '1 GC',
        enc: 1,
        reach: 'Average',
        damage: '+SB+4',
        qualities,
        availability: 'Common',
    };
}

function armor(id: string, ap: number, locations: string[], qualities: string[]): Armor {
    return {
        id,
        name: id,
        type: qualities.includes('Flexible') ? 'Mail' : 'Plate',
        price: '1 GC',
        enc: 1,
        penalty: '',
        locations,
        ap,
        qualities,
        availability: 'Common',
    };
}

function character(id: string, name: string, equippedWeapon: Weapon, armorItems: Armor[] = []): Character {
    const wounds = 12;
    const equippedArmor = Object.fromEntries(armorItems.map(item => [item.id, true]));
    const armorInventory = Object.fromEntries(armorItems.map(item => [item.id, 1]));
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
            ws: characteristic(40),
            bs: characteristic(30),
            s: characteristic(40),
            t: characteristic(30),
            i: characteristic(30),
            ag: characteristic(30),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
        ],
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
            weapons: { [equippedWeapon.id]: 1 },
            armor: armorInventory,
            items: {},
            equippedWeapons: { [equippedWeapon.id]: true },
            equippedArmor,
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
