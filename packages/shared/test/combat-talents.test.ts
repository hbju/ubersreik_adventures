import { describe, expect, it } from 'vitest';
import talentsData from '../src/data/talents_en.json';
import type { Character, Characteristic, Talent, Weapon } from '../src/types/wfrp.types';
import {
    catalogueCombatTalentCoverage,
    distinctCombatTalentConditions,
    evaluateTalentCondition,
    prepareTalentExtraAttack,
    registerTalentReactions,
    resolveTalentActivation,
    applyTalentRerollHook,
    talentActivationRegistry,
} from '../src/combat/talents';
import { resolveCombatAction } from '../src/combat/actions';
import { createCombatantFromCharacter, createCombatState, resolveMeleeAttack } from '../src/combat/engine';
import { engage } from '../src/combat/spatial';

const talents = talentsData as Talent[];

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

const dagger: Weapon = {
    id: 'weapon_dagger',
    name: 'Dagger',
    group: 'basic',
    price: '16 S',
    enc: 0,
    reach: 'Very Short',
    damage: '+SB+2',
    qualities: [],
    availability: 'Common',
};

describe('combat talent effects', () => {
    it('catalogues combat talents and default-off optional activations', () => {
        const coverage = catalogueCombatTalentCoverage(talents);
        expect(coverage.find(row => row.id === 'shieldsman')).toMatchObject({ classification: 'activated-or-reaction' });
        expect(coverage.find(row => row.id === 'furious-assault')).toMatchObject({ classification: 'deferred-action-economy' });
        expect(coverage.find(row => row.id === 'fearless')).toMatchObject({ classification: 'deferred-psychology' });
        expect(distinctCombatTalentConditions).toContain('defending with a shield');
        expect(talentActivationRegistry.shieldsman[0].policy).toBe('never');
    });

    it('applies Shieldsman defensive SL bonus and activated push spend', () => {
        let state = createCombatState([
            combatant('attacker', 'Attacker', { side: 'adversary', ws: 50, position: 0 }),
            combatant('shield', 'Shield', {
                side: 'ally',
                ws: 30,
                position: 1,
                talents: { shieldsman: 1 },
                weapons: { [shield.id]: 1 },
                equippedWeapons: { [shield.id]: true },
            }),
        ], { weapons: [shield], talents, advantagePools: { ally: 2, adversary: 0 } });
        state = engage(state, 'attacker', 'shield').state;

        const defended = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'shield',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 40 },
            defender: { skillId: 'melee_basic', targetNumber: 30, rollResult: 20 },
            grantAdvantage: false,
        });

        const attack = defended.events.find(event => event.type === 'AttackResolved');
        expect(attack?.data.outcome).toBe('defender');
        expect(attack?.data.defenderRoll.roundedSuccessLevel).toBe(2);

        const pushed = resolveTalentActivation(defended.state, {
            talentId: 'shieldsman',
            actorId: 'shield',
            targetId: 'attacker',
            trigger: 'onDefend',
            effect: 'push',
            policy: 'always',
        });
        expect(pushed.state.advantagePools.ally).toBe(0);
        expect(pushed.state.combatants.attacker.engagementIds).not.toContain('shield');
        expect(pushed.events.some(event => event.type === 'TalentEffectApplied')).toBe(true);
    });

    it('evaluates audited combat predicates', () => {
        let state = createCombatState([
            combatant('shield', 'Shield', {
                side: 'ally',
                talents: { shieldsman: 1, 'dual-wielder': 1 },
                weapons: { [shield.id]: 1 },
                equippedWeapons: { [shield.id]: true },
                loadout: { primaryWeaponId: shield.id, secondaryWeaponId: dagger.id },
            }),
            combatant('foe', 'Foe', { side: 'adversary', position: 1 }),
        ], { weapons: [shield, dagger], talents });
        state = engage(state, 'shield', 'foe').state;

        const context = {
            state,
            combatant: state.combatants.shield,
            opponent: state.combatants.foe,
            role: 'defender' as const,
            action: {
                attackerId: 'foe',
                defenderId: 'shield',
                attacker: { skillId: 'melee_basic', targetNumber: 40 },
                defender: { skillId: 'melee_basic', targetNumber: 40 },
            },
            testId: 'melee_basic',
        };

        expect(evaluateTalentCondition('defending with a shield', context)).toBe(true);
        expect(evaluateTalentCondition('when defending', context)).toBe(true);
        expect(evaluateTalentCondition('when attacking with two weapons', { ...context, role: 'attacker' })).toBe(true);
        expect(evaluateTalentCondition('unknown predicate', context)).toBe(false);
    });

    it('registers and resolves a Riposte reaction in a mocked window', () => {
        const state = createCombatState([
            combatant('duellist', 'Duellist', {
                side: 'ally',
                talents: { riposte: 1 },
                weapons: { [rapier.id]: 1 },
                equippedWeapons: { [rapier.id]: true },
            }),
            combatant('foe', 'Foe', { side: 'adversary', wounds: 12 }),
        ], { weapons: [rapier], talents });

        expect(registerTalentReactions(state, 'duellist')[0]).toMatchObject({
            type: 'TalentReactionRegistered',
            data: { talentId: 'riposte', window: 'winningDefence', policy: 'never' },
        });

        const riposte = resolveTalentActivation(state, {
            talentId: 'riposte',
            actorId: 'duellist',
            targetId: 'foe',
            trigger: 'reaction',
            policy: 'always',
        });
        expect(riposte.events[0]).toMatchObject({ type: 'TalentEffectApplied', data: { talentId: 'riposte', effect: 'reactionDamage' } });
        expect(riposte.state.combatants.foe.currentWounds).toBeLessThan(12);
    });

    it('routes reroll-granting talents through the Fortune reroll hook shape', () => {
        const state = createCombatState([
            combatant('sneak', 'Sneak', { talents: { 'alley-cat': 1 } }),
        ], { talents });
        const roll = {
            skillId: 'stealth_urban',
            rollResult: 82,
            targetNumber: 28,
            successLevel: -6,
            roundedSuccessLevel: -6,
            usedTalents: [],
        };

        const result = applyTalentRerollHook(roll, state, {
            talentId: 'alley-cat',
            actorId: 'sneak',
            testId: 'stealth_urban',
            rollResult: 82,
            targetNumber: 28,
            policy: 'always',
        });

        expect(result.hook).toEqual({ reroll: true, rerollResult: 28 });
        expect(result.roll.rollResult).toBe(28);
        expect(result.events[0]).toMatchObject({ type: 'TalentEffectApplied', data: { effect: 'reroll' } });
    });

    it('fills Dual Wielder attack-with-both and exposes action-economy flags', () => {
        const state = createCombatState([
            combatant('dual', 'Dual', {
                talents: { 'dual-wielder': 1, 'furious-assault': 1 },
                weapons: { [dagger.id]: 2 },
                equippedWeapons: { [dagger.id]: true },
                loadout: { primaryWeaponId: dagger.id, secondaryWeaponId: dagger.id },
            }),
        ], { weapons: [dagger], talents });

        const dual = resolveCombatAction(state, {
            kind: 'attackWithBoth',
            actorId: 'dual',
            targetId: 'foe',
            rollResult: 34,
        });
        expect(dual.events.find(event => event.type === 'TalentEffectApplied')).toMatchObject({
            data: { talentId: 'dual-wielder', effect: 'attackWithBoth', primaryRoll: 34, secondaryRoll: 43 },
        });

        const extra = prepareTalentExtraAttack(state, 'dual', 'always');
        expect(extra.state.turnFlags.talentExtraAttackCombatantIds).toEqual(['dual']);
        expect(extra.events[0]).toMatchObject({ type: 'TalentEffectApplied', data: { talentId: 'furious-assault', effect: 'extraAttack' } });
    });
});

interface CombatantOptions {
    side?: 'ally' | 'adversary';
    ws?: number;
    wounds?: number;
    position?: number;
    talents?: Record<string, number>;
    weapons?: Record<string, number>;
    equippedWeapons?: Record<string, boolean>;
    loadout?: { primaryWeaponId?: string; secondaryWeaponId?: string };
}

function combatant(id: string, name: string, options: CombatantOptions = {}) {
    return {
        ...createCombatantFromCharacter(makeCharacter(id, name, options), {
            id,
            side: options.side ?? 'ally',
            position: options.position ?? 0,
        }),
        weaponLoadout: options.loadout,
    };
}

function makeCharacter(id: string, name: string, options: CombatantOptions = {}): Character {
    const characteristic = (value: number): Characteristic => ({
        initial: value,
        advances: 0,
        talents: 0,
        modifier: 0,
    });
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
            ws: characteristic(options.ws ?? 40),
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
        talents: options.talents ?? {},
        inventory: {
            weapons: options.weapons ?? {},
            armor: {},
            items: {},
            equippedWeapons: options.equippedWeapons ?? {},
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}
