import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    createCombatState,
    createCombatantFromCharacter,
    rangeBandForDistance,
    rangedDefenceOptions,
    resolveCombatAction,
    resolveRangedAttack,
    RangedShotRejectedEvent
} from '../../src/combat';

const bow: Weapon = {
    id: 'bow',
    name: 'Bow',
    group: 'bow',
    price: '1 GC',
    enc: 1,
    reach: '50',
    damage: '+8',
    qualities: [],
    availability: 'Common',
};

const accurateBow: Weapon = { ...bow, id: 'accurate-bow', qualities: ['Accurate'] };
const pistol: Weapon = {
    ...bow,
    id: 'pistol',
    name: 'Pistol',
    group: 'blackpowder',
    reach: '20',
    damage: '+8',
    qualities: ['Pistol', 'Blackpowder'],
};
const shield: Weapon = { ...bow, id: 'shield', name: 'Shield', group: 'basic', reach: 'Short', damage: '+SB+1', qualities: ['Shield 2'] };

describe('ranged combat 4a', () => {
    it('derives ranged bands at boundaries', () => {
        expect(rangeBandForDistance(5, 50)).toBe('pointBlank');
        expect(rangeBandForDistance(25, 50)).toBe('short');
        expect(rangeBandForDistance(50, 50)).toBe('normal');
        expect(rangeBandForDistance(100, 50)).toBe('long');
        expect(rangeBandForDistance(150, 50)).toBe('extreme');
        expect(rangeBandForDistance(151, 50)).toBe('outOfRange');
    });

    it('exposes opposed defence options for shield, point blank, and engaged shots', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0);
        const target = combatant('target', 'adversary', ['shield'], 4, { equippedWeapons: { shield: true }, engagementIds: ['attacker'] });
        const state = createCombatState([attacker, target], { weapons: [bow, shield] });

        expect(rangedDefenceOptions(target, { state, attackerId: attacker.id, distance: 4, rangeBand: 'pointBlank' }).map(option => option.kind))
            .toEqual(['shieldParry', 'shieldBasic', 'pointBlankDodge', 'engagedMelee']);
    });

    it('hits on an unopposed successful shot and grants hit-only Advantage', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0);
        const target = combatant('target', 'adversary', [], 20);
        const state = createCombatState([attacker, target], { weapons: [bow] });

        const result = resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 20,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 24, weaponId: 'bow' },
        });

        expect(result.events.find(event => event.type === 'AttackResolved')?.data.outcome).toBe('attacker');
        expect(result.state.advantagePools.ally).toBe(1);
        expect(result.events.some(event => event.type === 'DamageDealt')).toBe(true);
    });

    it('negates an opposed shot when the target wins without counter-damage or defender Advantage', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0);
        const target = combatant('target', 'adversary', [], 4);
        const state = createCombatState([attacker, target], { weapons: [bow] });

        const result = resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 4,
            defenceKind: 'pointBlankDodge',
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 45, weaponId: 'bow' },
            defender: { skillId: 'dodge', targetNumber: 90, rollResult: 1 },
        });

        expect(result.events.find(event => event.type === 'AttackResolved')?.data.outcome).toBe('defender');
        expect(result.events.some(event => event.type === 'DamageDealt')).toBe(false);
        expect(result.state.advantagePools).toEqual({ ally: 0, adversary: 0 });
    });

    it('caps the ranged modifier stack and consumes Aim from the action flag', () => {
        const attacker = combatant('attacker', 'ally', ['accurate-bow'], 0, { aimedRangedAttack: true });
        const target = combatant('target', 'adversary', [], 150, { tags: ['size:large'] });
        const state = createCombatState([attacker, target], { weapons: [accurateBow] });

        const result = resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 150,
            cover: 'hard',
            shootingWhileMoving: true,
            darkness: true,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 40, weaponId: 'accurate-bow' },
        });
        const resolved = result.events.find(event => event.type === 'AttackResolved');

        expect(resolved?.data.modifiers?.cappedPenalty).toBe(-30);
        expect(resolved?.data.modifiers?.cappedBonus).toBe(50);
        expect(resolved?.data.attackerRoll.targetNumber).toBe(70);
        expect(result.state.combatants.attacker.aimedRangedAttack).toBe(false);
    });

    it('supports Aim through the action dispatcher', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0);
        const target = combatant('target', 'adversary', [], 20);
        const state = createCombatState([attacker, target], { weapons: [bow] });

        const aimed = resolveCombatAction(state, { kind: 'aim', actorId: attacker.id });
        const shot = resolveRangedAttack(aimed.state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 20,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 65, weaponId: 'bow' },
        });

        expect(shot.events.find(event => event.type === 'AttackResolved')?.data.attackerRoll.targetNumber).toBe(90);
    });

    it('rolls ranged criticals on successful doubles and blackpowder misfires on even doubles', () => {
        const attacker = combatant('attacker', 'ally', ['bow', 'pistol'], 0);
        const target = combatant('target', 'adversary', [], 20);
        const state = createCombatState([attacker, target], { weapons: [bow, pistol] });

        const crit = resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 20,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 33, weaponId: 'bow' },
        });
        const misfire = resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 20,
            attacker: { skillId: 'ranged_blackpowder', targetNumber: 50, rollResult: 22, weaponId: 'pistol' },
        });

        expect(crit.events.some(event => event.type === 'CritRolled')).toBe(true);
        expect(misfire.events.some(event => event.type === 'RangedMisfire')).toBe(true);
        expect(misfire.events.find(event => event.type === 'DamageDealt')?.data.hitLocation).toBe('Primary Arm');
    });

    it('applies pure ranged qualities and talents', () => {
        const attacker = combatant('attacker', 'ally', ['accurate-bow'], 0, {
            talents: { 'accurate-shot': 2, 'sure-shot': 1, sniper: 1, sharpshooter: 1, 'dead-eye-shot': 1 },
        });
        const target = combatant('target', 'adversary', [], 100, { tags: ['size:tiny'] });
        const state = createCombatState([attacker, target], { weapons: [accurateBow], armor: [helmet] });

        const result = resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 100,
            chosenHitLocation: 'Head',
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 24, weaponId: 'accurate-bow' },
        });
        const resolved = result.events.find(event => event.type === 'AttackResolved');
        const damage = result.events.find(event => event.type === 'DamageDealt');

        expect(resolved?.data.hitLocation).toBe('Head');
        expect(resolved?.data.modifiers?.sources.some(source => source.id === 'quality:accurate')).toBe(true);
        expect(resolved?.data.modifiers?.sources.some(source => source.id === 'size:difference')).toBe(false);
        expect(resolved?.data.modifiers?.sources.some(source => source.id === 'range:long')).toBe(false);
        expect(damage?.data.rawDamage).toBeGreaterThan(8);
        expect(damage?.data.armourPoints).toBe(1);
    });

    it('rejects non-pistol shots while engaged and shots beyond extreme range', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0, { engagementIds: ['target'] });
        const target = combatant('target', 'adversary', [], 200);
        const state = createCombatState([attacker, target], { weapons: [bow] });

        expect((resolveRangedAttack(state, {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 20,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 24, weaponId: 'bow' },
        }).events[0] as RangedShotRejectedEvent).data.reason).toBe('engagedWithoutPistol');

        expect((resolveRangedAttack(createCombatState([{ ...attacker, engagementIds: [] }, target], { weapons: [bow] }), {
            attackerId: attacker.id,
            defenderId: target.id,
            distance: 151,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 24, weaponId: 'bow' },
        }).events[0] as RangedShotRejectedEvent).data.reason).toBe('outOfRange');
    });
});

const helmet = {
    id: 'helmet',
    name: 'Helmet',
    type: 'Mail' as const,
    penalty: '',
    locations: ['Head'],
    ap: 2,
    qualities: [],
    price: '1 GC',
    enc: 1,
    availability: 'Common' as const,
};

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], position: number, overrides: Record<string, unknown> = {}) {
    const character = characterFixture(id, weapons, overrides.talents as Record<string, number> | undefined, overrides.tags as string[] | undefined);
    return {
        ...createCombatantFromCharacter(character, {
            id,
            side,
            position,
            engagementIds: (overrides.engagementIds as string[] | undefined) ?? [],
            weaponLoadout: { primaryWeaponId: weapons[0] },
        }),
        ...(overrides.aimedRangedAttack === true ? { aimedRangedAttack: true } : {}),
    };
}

function characterFixture(id: string, weapons: string[], talents: Record<string, number> = {}, tags: string[] = []): Character {
    const characteristic = (value: number) => ({ initial: value, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: null,
        tags,
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
            { id: 'ranged_bow', name: 'Ranged (Bow)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'ranged_blackpowder', name: 'Ranged (Blackpowder)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'melee_parry', name: 'Melee (Parry)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 12, max: 12 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents,
        inventory: {
            weapons: Object.fromEntries(weapons.map(weapon => [weapon, 1])),
            armor: { helmet: 1 },
            items: {},
            equippedWeapons: Object.fromEntries(weapons.map((weapon, index) => [weapon, index === 0])),
            equippedArmor: { helmet: true },
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
