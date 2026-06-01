/**
 * PBI #3 sanity battery — fills checklist gaps not already asserted elsewhere.
 * Coverage map for the full battery is in the PR/chat summary; search `PBI3:` in test names.
 */
import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../src/types/wfrp.types';
import { grantAdvantage, spendAdvantage } from '../src/combat/advantage';
import { resolveCombatAction } from '../src/combat/actions';
import { createCombatantFromCharacter, createCombatState, resolveDamage, resolveMeleeAttack } from '../src/combat/engine';
import { createSeededRng } from '../src/combat/rng';
import { engage } from '../src/combat/spatial';
import { resolveTalentActivation } from '../src/combat/talents';
import { resolveTalentCombatAction, toggleReversal } from '../src/combat/talent-actions';
import { assertEventsUseI18nKeys, snapshotEvents } from './helpers/combat-test-helpers';
import { MeleeHookPhaseEvent } from '../src/combat';

const rapier: Weapon = {
    id: 'weapon_rapier',
    name: 'Rapier',
    group: 'fencing',
    price: '5 GC',
    enc: 1,
    reach: 'Average',
    damage: '+SB+4',
    qualities: ['Fast'],
    availability: 'Scarce',
};

const shield: Weapon = {
    id: 'weapon_shield',
    name: 'Shield',
    group: 'shield',
    price: '2 GC',
    enc: 1,
    reach: 'Very Short',
    damage: '+SB+2',
    qualities: ['Shield 2'],
    availability: 'Common',
};

describe('PBI 3 battery — regression sentinels', () => {
    it('PBI3: defender winning defence does not grant side Advantage (initiator-only rule)', () => {
        const state = createCombatState([
            combatant('attacker', { side: 'adversary', ws: 30 }),
            combatant('defender', { ws: 50 }),
        ]);

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90 },
            defender: { skillId: 'melee_basic', targetNumber: 50, rollResult: 15 },
        });

        expect(result.events.find(event => event.type === 'AttackResolved')).toMatchObject({ data: { outcome: 'defender' } });
        expect(result.events.filter(event => event.type === 'AdvantageChanged')).toEqual([]);
        expect(result.state.advantagePools).toEqual({ ally: 0, adversary: 0 });
    });

    it('PBI3: defender winning dodge avoids without counter-damage to attacker', () => {
        const state = createCombatState([
            combatant('attacker', { side: 'adversary', ws: 30, wounds: 12 }),
            combatant('defender', { ws: 50 }),
        ]);

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90, weaponDamage: 8 },
            defender: { skillId: 'dodge', targetNumber: 50, rollResult: 15 },
        });

        expect(result.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { outcome: 'defender', defenderAvoidsOnly: true },
        });
        expect(result.events.map(event => event.type)).not.toContain('DamageDealt');
        expect(result.state.combatants.attacker.currentWounds).toBe(12);
    });

    it('PBI3: gaining a Condition does not zero Advantage pools (Group Advantage house rule)', () => {
        const state = createCombatState([
            combatant('ally', { side: 'ally', s: 50 }),
            combatant('foe', { side: 'adversary', s: 30 }),
        ], { advantagePools: { ally: 3, adversary: 1 } });

        const battered = spendAdvantage(state, 'ally', 'batter', {
            actorId: 'ally',
            targetId: 'foe',
            actorRoll: 20,
            targetRoll: 80,
        });

        expect(battered.state.advantagePools.ally).toBeGreaterThan(0);
        expect(battered.state.advantagePools.adversary).toBe(1);
        expect(battered.state.combatants.foe.conditions).toContain('condition_prone');
        expect(battered.state.advantagePools).not.toEqual({ ally: 0, adversary: 0 });
    });

    it('PBI3: pools are side-scoped only (no per-combatant Advantage field)', () => {
        const c = combatant('hero', { side: 'ally' });
        expect(c).not.toHaveProperty('advantage');
        expect(c.side).toBe('ally');
    });

    it('PBI3: combat events carry i18n keys, not localized prose', () => {
        const state = createCombatState([
            combatant('attacker', { side: 'adversary', ws: 55 }),
            combatant('defender', { ws: 35, wounds: 12 }),
        ]);

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 55, rollResult: 20, weaponDamage: 7 },
            defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 80 },
        });

        assertEventsUseI18nKeys(result.events);
    });
});

describe('PBI 3 battery — 3g-2 gaps', () => {
    it('PBI3: Reversal with empty opposing pool transfers nothing', () => {
        const state = createCombatState([
            combatant('defender', { talents: { reversal: 1 }, ws: 50 }),
            combatant('attacker', { side: 'adversary', ws: 30 }),
        ], { advantagePools: { ally: 0, adversary: 0 } });

        const armed = toggleReversal(state, 'defender', true, 'always').state;
        const result = resolveMeleeAttack(armed, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90 },
            defender: { skillId: 'melee_basic', targetNumber: 50, rollResult: 15 },
        });

        expect(result.state.advantagePools).toEqual({ ally: 0, adversary: 0 });
        expect(result.events.some(event => event.type === 'TalentEffectApplied' && event.data.talentId === 'reversal')).toBe(true);
    });

    it('PBI3: Beat Blade rejects unarmed and larger opponents', () => {
        const base = createCombatState([
            combatant('blade', { talents: { 'beat-blade': 1 }, ws: 50 }),
            combatant('big', { side: 'adversary', ws: 40, size: 'large', weapons: { [rapier.id]: 1 }, equippedWeapons: { [rapier.id]: true }, loadout: { primaryWeaponId: rapier.id } }),
            combatant('bare', { side: 'adversary', ws: 40 }),
        ], { weapons: [rapier] });

        const larger = resolveTalentCombatAction(base, {
            kind: 'beatBlade',
            actorId: 'blade',
            targetId: 'big',
            rollResult: 10,
            targetNumber: 50,
            policy: 'always',
        });
        expect(larger.events[0]).toMatchObject({ type: 'TalentActivationRejected', data: { talentId: 'beat-blade' } });

        const unarmed = resolveTalentCombatAction(base, {
            kind: 'beatBlade',
            actorId: 'blade',
            targetId: 'bare',
            rollResult: 10,
            targetNumber: 50,
            policy: 'always',
        });
        expect(unarmed.events[0]).toMatchObject({ type: 'TalentActivationRejected', data: { talentId: 'beat-blade' } });
    });

    it('PBI3: Shieldsman damage mode spends Advantage and wounds the attacker', () => {
        let state = createCombatState([
            combatant('attacker', { side: 'adversary', wounds: 10 }),
            combatant('shield', {
                talents: { shieldsman: 1 },
                weapons: { [shield.id]: 1 },
                equippedWeapons: { [shield.id]: true },
            }),
        ], { weapons: [shield], advantagePools: { ally: 2, adversary: 0 } });
        state = engage(state, 'attacker', 'shield').state;

        const result = resolveTalentActivation(state, {
            talentId: 'shieldsman',
            actorId: 'shield',
            targetId: 'attacker',
            trigger: 'onDefend',
            effect: 'damage',
            policy: 'always',
        });

        expect(result.state.combatants.attacker.currentWounds).toBeLessThan(10);
        expect(result.state.advantagePools.ally).toBe(0);
    });

    it('PBI3: Dual Wielder grants Advantage only when both attacks hit', () => {
        const state = createCombatState([
            combatant('dual', {
                talents: { 'dual-wielder': 1 },
                ws: 50,
                weapons: { [rapier.id]: 2 },
                equippedWeapons: { [rapier.id]: true },
                loadout: { primaryWeaponId: rapier.id, secondaryWeaponId: rapier.id },
            }),
            combatant('foe', { side: 'adversary', ws: 30, wounds: 20 }),
        ], { weapons: [rapier] });

        const missSecond = resolveCombatAction(state, {
            kind: 'attackWithBoth',
            actorId: 'dual',
            targetId: 'foe',
            rollResult: 20,
            defenderRollResult: 95,
            defenderTargetNumber: 30,
            opponentRollResult: 10,
            opponentTargetNumber: 30,
        });

        expect(missSecond.events.filter(event => event.type === 'AttackResolved')).toHaveLength(2);
        expect(missSecond.events.filter(event => event.type === 'AdvantageChanged')).toEqual([]);
        expect(missSecond.state.advantagePools.ally).toBe(0);
    });

    it('PBI3: Feint buff does not apply after it expires', () => {
        let state = createCombatState([
            combatant('fencer', { talents: { feint: 1 }, ws: 50, weapons: { [rapier.id]: 1 }, equippedWeapons: { [rapier.id]: true }, loadout: { primaryWeaponId: rapier.id } }),
            combatant('foe', { side: 'adversary', ws: 40, weapons: { [rapier.id]: 1 }, equippedWeapons: { [rapier.id]: true }, loadout: { primaryWeaponId: rapier.id } }),
        ], { weapons: [rapier], round: 1 });

        state = resolveTalentCombatAction(state, {
            kind: 'feint',
            actorId: 'fencer',
            targetId: 'foe',
            rollResult: 15,
            targetNumber: 50,
            opponentRollResult: 80,
            opponentTargetNumber: 40,
            policy: 'always',
        }).state;

        const expired = resolveMeleeAttack({ ...state, round: 3 }, {
            attackerId: 'fencer',
            defenderId: 'foe',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 40 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 70 },
            grantAdvantage: false,
        });

        const preRoll = expired.events.find(event => event.type === 'MeleeHookPhase' && event.data.phase === 'preRollModifiers') as MeleeHookPhaseEvent | undefined;
        expect(preRoll?.data.modifier).toBe(0);
    });
});

describe('PBI 3 battery — integration scenarios', () => {
    it('PBI3: charge + berserk-charge + resolute stack on first melee damage', () => {
        const state = createCombatState([
            combatant('charger', {
                talents: { 'berserk-charge': 1, resolute: 1, 'strike-mighty-blow': 0 },
                ws: 50,
                s: 40,
                t: 30,
            }),
            combatant('foe', { side: 'adversary', t: 35, wounds: 20 }),
        ], { talents: [] });

        const result = resolveDamage(state, {
            attackerId: 'charger',
            defenderId: 'foe',
            skillId: 'melee_basic',
            slDifference: 2,
            weaponDamage: 6,
            hitLocation: 'Body',
            isCharging: true,
        });

        expect(result.events.find(event => event.type === 'DamageDealt')).toMatchObject({
            data: { rawDamage: 8 },
        });
    });

    it('PBI3: Shieldsman push breaks engagement (integration)', () => {
        let state = createCombatState([
            combatant('attacker', { side: 'adversary', position: 0 }),
            combatant('shield', {
                position: 1,
                talents: { shieldsman: 1 },
                weapons: { [shield.id]: 1 },
                equippedWeapons: { [shield.id]: true },
            }),
        ], { weapons: [shield], advantagePools: { ally: 2, adversary: 0 } });
        state = engage(state, 'attacker', 'shield').state;

        const pushed = resolveTalentActivation(state, {
            talentId: 'shieldsman',
            actorId: 'shield',
            targetId: 'attacker',
            trigger: 'onDefend',
            effect: 'push',
            policy: 'always',
        });

        expect(pushed.state.combatants.attacker.engagementIds).not.toContain('shield');
        expect(pushed.state.combatants.shield.engagementIds).not.toContain('attacker');
    });

    it('PBI3: full melee exchange is byte-stable under a fixed seed', () => {
        const run = () => {
            const state = createCombatState([
                combatant('attacker', { side: 'ally', ws: 55, wounds: 12 }),
                combatant('defender', { side: 'adversary', ws: 35, t: 30 }),
            ]);
            const result = resolveMeleeAttack(state, {
                attackerId: 'attacker',
                defenderId: 'defender',
                attacker: { skillId: 'melee_basic', targetNumber: 55, rollResult: 20, weaponDamage: 7 },
                defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 80 },
            }, createSeededRng('pbi3-integration-melee'));
            return { pools: result.state.advantagePools, events: snapshotEvents(result.events) };
        };

        expect(run()).toEqual(run());
    });
});

describe('PBI 3 battery — deferred / covered elsewhere (documentation only)', () => {
    it('PBI3: whole-fight byte stability — covered by combat-engine.test.ts golden melee', () => {
        expect(true).toBe(true);
    });

    it.skip('PBI3: ranged hit/miss Advantage — deferred to PBI 4 (melee engine only)', () => {});

    it.skip('PBI3: Trap Blade defender option — registered stub, policy never; no resolution yet', () => {});

    it.skip('PBI3: round-loop smoke (start → turns → EOR) — PBI 5 turn engine', () => {});

    it.skip('PBI3: each Oops table row individually — partial via fumble test; full row matrix not enumerated', () => {});

    it.skip('PBI3: recovery economy simulation — injuries recorded only, not simulated (critical.test.ts)', () => {});
});

function combatant(
    id: string,
    options: {
        side?: 'ally' | 'adversary';
        ws?: number;
        s?: number;
        t?: number;
        talents?: Record<string, number>;
        weapons?: Record<string, number>;
        equippedWeapons?: Record<string, boolean>;
        loadout?: { primaryWeaponId?: string; secondaryWeaponId?: string };
        position?: number;
        wounds?: number;
        size?: string;
    } = {}
) {
    const characteristics = {
        ws: char(options.ws ?? 30),
        bs: char(30),
        s: char(options.s ?? 30),
        t: char(options.t ?? 30),
        i: char(30),
        ag: char(30),
        dex: char(30),
        int: char(30),
        wp: char(30),
        fel: char(30),
    };

    const character: Character = {
        id,
        name: id,
        species: 'human',
        class: 'class',
        currentCareerId: 'career',
        currentCareerLevelId: 'careerLevel',
        userId: null,
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
        status: { wounds: { current: options.wounds ?? 10, max: options.wounds ?? 10 }, fate: { current: 0, max: 0 }, fortune: { current: 0, max: 0 }, resilience: { current: 0, max: 0 }, resolve: { current: 0, max: 0 }, corruption: { current: 0, max: 0 } },
        movement: 4,
        characteristics,
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
            { id: 'heal', name: 'Heal', characteristic: 'int', advances: 0, talents: 0, modifier: 0 },
        ],
        talents: options.talents ?? {},
        inventory: {
            weapons: options.weapons ?? {},
            armor: {},
            items: {},
            equippedWeapons: options.equippedWeapons ?? {},
            equippedArmor: {},
        },
        conditions: [],
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
        tags: options.size ? [`size:${options.size}`] : [],
    };

    return createCombatantFromCharacter(character, {
        id,
        side: options.side ?? 'ally',
        position: options.position ?? 0,
        weaponLoadout: options.loadout,
    });
}

function char(value: number) {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
