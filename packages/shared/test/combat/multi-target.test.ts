import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    createCombatState,
    createCombatantFromCharacter,
    resolveBlastAttack,
    resolveRangedGroupAttack,
    resolveRangedIntoMeleeAttack,
    resolveSpreadAttack,
    resolveThrownAttack,
    type CombatEvent,
    type Rng,
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
const blastBow: Weapon = { ...bow, id: 'blast-bow', qualities: ['Blast 2'] };
const spreadGun: Weapon = { ...bow, id: 'spread-gun', group: 'blackpowder', reach: '20', damage: '+8', qualities: ['Spread 2'] };
const throwingAxe: Weapon = { ...bow, id: 'throwing-axe', group: 'throwing', reach: 'Varies', damage: '+SB+3', qualities: [] };
const impaleBow: Weapon = { ...bow, id: 'impale-bow', qualities: ['Impale'] };

describe('ranged combat 4c', () => {
    it('applies group size bonuses and selects the struck member with seeded RNG', () => {
        for (const [count, expected] of [[3, 20], [7, 40], [13, 60]] as const) {
            const attacker = combatant(`attacker-${count}`, 'ally', ['bow'], 0);
            const targets = Array.from({ length: count }, (_, index) => combatant(`target-${count}-${index}`, 'adversary', [], 20 + index));
            const state = createCombatState([attacker, ...targets], { weapons: [bow] });

            const result = resolveRangedGroupAttack(state, {
                attackerId: attacker.id,
                candidateTargetIds: targets.map(target => target.id),
                distance: 20,
                attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 24, weaponId: 'bow' },
            }, sequenceRng(0.28));
            const resolved = attack(result.events);
            const multiEvent = multi(result.events);

            expect(resolved?.data.modifiers.sources.find(source => source.type === 'group')?.value).toBe(expected);
            expect(resolved?.data.defenderId).toBe(targets[Math.floor(0.28 * count)].id);
            expect(multiEvent?.data.mode).toBe('group');
            expect(multiEvent?.data.targetIds).toHaveLength(count);
        }
    });

    it('resolves shooting into melee for penalised hits, redirects near misses, and leaves clean misses alone', () => {
        const shooter = combatant('shooter', 'ally', ['bow'], 0);
        const enemy = combatant('enemy', 'adversary', [], 50, { engagementIds: ['friend'] });
        const friend = combatant('friend', 'ally', [], 50, { engagementIds: ['enemy'] });
        const state = createCombatState([shooter, enemy, friend], { weapons: [bow] });

        const penalisedHit = resolveRangedIntoMeleeAttack(state, {
            enabled: true,
            attackerId: shooter.id,
            defenderId: enemy.id,
            distance: 50,
            attacker: { skillId: 'ranged_bow', targetNumber: 60, rollResult: 35, weaponId: 'bow' },
        }, sequenceRng(0.1));
        expect(attack(penalisedHit.events)?.data.outcome).toBe('attacker');
        expect(multi(penalisedHit.events)?.data.targetIds).toEqual(['enemy']);

        const redirected = resolveRangedIntoMeleeAttack(state, {
            enabled: true,
            attackerId: shooter.id,
            defenderId: enemy.id,
            distance: 50,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 40, weaponId: 'bow' },
        }, sequenceRng(0.1));
        expect(redirected.events.filter(event => event.type === 'AttackResolved')).toHaveLength(2);
        expect(attack(redirected.events)?.data.outcome).toBe('defender');
        expect(multi(redirected.events)?.data.primaryTargetId).toBe('friend');
        expect(redirected.events.some(event => event.type === 'DamageDealt' && event.data.defenderId === 'friend')).toBe(true);

        const cleanMiss = resolveRangedIntoMeleeAttack(state, {
            enabled: true,
            attackerId: shooter.id,
            defenderId: enemy.id,
            distance: 50,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 60, weaponId: 'bow' },
        }, sequenceRng(0.1));
        expect(cleanMiss.events.filter(event => event.type === 'AttackResolved')).toHaveLength(1);
        expect(cleanMiss.events.some(event => event.type === 'RangedMultiTargetResolved')).toBe(false);
    });

    it('supports the into-melee friendly-fire-as-group variant', () => {
        const shooter = combatant('shooter', 'ally', ['bow'], 0);
        const enemy = combatant('enemy', 'adversary', [], 20, { engagementIds: ['friend', 'bystander'] });
        const friend = combatant('friend', 'ally', [], 20, { engagementIds: ['enemy'] });
        const bystander = combatant('bystander', 'adversary', [], 20, { engagementIds: ['enemy'] });
        const state = createCombatState([shooter, enemy, friend, bystander], { weapons: [bow] });

        const result = resolveRangedIntoMeleeAttack(state, {
            enabled: true,
            mode: 'groupFriendlyFire',
            attackerId: shooter.id,
            defenderId: enemy.id,
            distance: 20,
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 24, weaponId: 'bow' },
        }, sequenceRng(0.4));

        expect(multi(result.events)?.data.mode).toBe('group');
        expect(multi(result.events)?.data.targetIds.sort()).toEqual(['bystander', 'enemy', 'friend']);
        expect(attack(result.events)?.data.modifiers.sources.find(source => source.type === 'group')?.value).toBe(20);
    });

    it('applies Blast to every creature in the 1D radius, including allies, with per-target locations', () => {
        const shooter = combatant('shooter', 'ally', ['blast-bow'], 0);
        const primary = combatant('primary', 'adversary', [], 10);
        const ally = combatant('ally', 'ally', [], 11);
        const enemy = combatant('enemy', 'adversary', [], 12);
        const far = combatant('far', 'adversary', [], 13);
        const state = createCombatState([shooter, primary, ally, enemy, far], { weapons: [blastBow] });

        const result = resolveBlastAttack(state, {
            attackerId: shooter.id,
            defenderId: primary.id,
            distance: 10,
            attacker: { skillId: 'ranged_bow', targetNumber: 70, rollResult: 24, weaponId: 'blast-bow' },
        }, sequenceRng(0.09, 0.55));

        expect(multi(result.events)?.data.targetIds.sort()).toEqual(['ally', 'enemy', 'primary']);
        expect(damagedIds(result.events).sort()).toEqual(['ally', 'enemy', 'primary']);
        expect(result.events.filter(event => event.type === 'DamageDealt').map(event => event.data.hitLocation)).toEqual(['Left Arm', 'Head', 'Body']);
    });

    it('handles Spread at point blank, chained ranges, and extreme range damage penalties', () => {
        const shooter = combatant('shooter', 'ally', ['spread-gun'], 0);
        const primary = combatant('primary', 'adversary', [], 2);
        const near1 = combatant('near1', 'ally', [], 3);
        const near2 = combatant('near2', 'adversary', [], 5);
        const far = combatant('far', 'adversary', [], 8);
        const state = createCombatState([shooter, primary, near1, near2, far], { weapons: [spreadGun] });

        const pointBlank = resolveSpreadAttack(state, {
            attackerId: shooter.id,
            defenderId: primary.id,
            distance: 2,
            attacker: { skillId: 'ranged_blackpowder', targetNumber: 80, rollResult: 24, weaponId: 'spread-gun' },
        }, sequenceRng(0.2));
        expect(multi(pointBlank.events)?.data.targetIds).toEqual(['primary']);
        expect(pointBlank.events.find(event => event.type === 'DamageDealt')?.data.rawDamage).toBe(17);

        const chained = resolveSpreadAttack(state, {
            attackerId: shooter.id,
            defenderId: primary.id,
            distance: 8,
            attacker: { skillId: 'ranged_blackpowder', targetNumber: 80, rollResult: 24, weaponId: 'spread-gun' },
        }, sequenceRng(0.03, 0.55));
        expect(multi(chained.events)?.data.targetIds).toEqual(['primary', 'near1', 'near2']);
        expect(damagedIds(chained.events).sort()).toEqual(['near1', 'near2', 'primary']);

        const extreme = resolveSpreadAttack(createCombatState([shooter, { ...primary, position: 50 }], { weapons: [spreadGun] }), {
            attackerId: shooter.id,
            defenderId: primary.id,
            distance: 50,
            attacker: { skillId: 'ranged_blackpowder', targetNumber: 80, rollResult: 24, weaponId: 'spread-gun' },
        }, sequenceRng(0.2));
        expect(multi(extreme.events)?.data.rangeBand).toBe('extreme');
        expect(extreme.events.find(event => event.type === 'DamageDealt')?.data.rawDamage).toBe(9);
    });

    it('uses Strength Bonus range for thrown weapons and records lodged ammunition on ranged Impale crits', () => {
        const thrower = combatant('thrower', 'ally', ['throwing-axe'], 0);
        const target = combatant('target', 'adversary', [], 9);
        const thrownState = createCombatState([thrower, target], { weapons: [throwingAxe] });

        const hit = resolveThrownAttack(thrownState, {
            attackerId: thrower.id,
            defenderId: target.id,
            distance: 9,
            attacker: { skillId: 'ranged_throwing', targetNumber: 50, rollResult: 24, weaponId: 'throwing-axe' },
        }, sequenceRng(0.1));
        expect(attack(hit.events)?.data.outcome).toBe('attacker');
        expect(multi(hit.events)?.data.mode).toBe('thrown');

        const outOfRange = resolveThrownAttack(thrownState, {
            attackerId: thrower.id,
            defenderId: target.id,
            distance: 28,
            attacker: { skillId: 'ranged_throwing', targetNumber: 50, rollResult: 24, weaponId: 'throwing-axe' },
        }, sequenceRng(0.1));
        expect(outOfRange.events[0].type).toBe('RangedShotRejected');

        const archer = combatant('archer', 'ally', ['impale-bow'], 0);
        const impaled = createCombatState([archer, combatant('victim', 'adversary', [], 20)], { weapons: [impaleBow] });
        const crit = resolveRangedGroupAttack(impaled, {
            attackerId: archer.id,
            candidateTargetIds: ['victim'],
            distance: 20,
            attacker: { skillId: 'ranged_bow', targetNumber: 70, rollResult: 33, weaponId: 'impale-bow' },
        }, sequenceRng(0.1));
        expect(crit.events.some(event => event.type === 'CritRolled')).toBe(true);
        expect(crit.events.find(event => event.type === 'LodgedAmmunitionRecorded')?.data).toMatchObject({
            defenderId: 'victim',
            removalTest: 'healChallenging',
        });
    });
});

function attack(events: CombatEvent[]) {
    return events.find(event => event.type === 'AttackResolved');
}

function multi(events: CombatEvent[]) {
    return events.find(event => event.type === 'RangedMultiTargetResolved');
}

function damagedIds(events: CombatEvent[]): string[] {
    return events
        .filter(event => event.type === 'DamageDealt')
        .map(event => event.data.defenderId);
}

function sequenceRng(...values: number[]): Rng {
    let index = 0;
    return {
        next: () => values[index++] ?? values[values.length - 1] ?? 0,
    };
}

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], position: number, overrides: Record<string, unknown> = {}) {
    const character = characterFixture(id, weapons, overrides.talents as Record<string, number> | undefined);
    return createCombatantFromCharacter(character, {
        id,
        side,
        position,
        engagementIds: (overrides.engagementIds as string[] | undefined) ?? [],
        weaponLoadout: { primaryWeaponId: weapons[0] },
    });
}

function characterFixture(id: string, weapons: string[], talents: Record<string, number> = {}): Character {
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
            { id: 'ranged_bow', name: 'Ranged (Bow)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'ranged_blackpowder', name: 'Ranged (Blackpowder)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'ranged_throwing', name: 'Ranged (Throwing)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'melee_parry', name: 'Melee (Parry)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
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
        talents,
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
