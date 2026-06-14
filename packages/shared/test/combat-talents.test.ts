import { describe, expect, it } from 'vitest';
import talentsData from '../src/data/talents_en.json';
import combatTalentsData from '../src/data/combat_talents.json';
import type { Character, Characteristic, Talent, Weapon } from '../src/types/wfrp.types';
import {
    calledShotPenaltyFor,
    catalogueCombatTalentCoverage,
    distinctCombatTalentConditions,
    evaluateTalentCondition,
    offHandPenaltyFor,
    prepareTalentExtraAttack,
    registerTalentReactions,
    resolveTalentActivation,
    applyTalentRerollHook,
    resolveTalentConditionReaction,
    talentActivationRegistry,
} from '../src/combat/talents';
import { reallocateEndOfRound, seedInitialAdvantage, spendAdvantage } from '../src/combat/advantage';
import { resolveCombatAction } from '../src/combat/actions';
import { createCombatantFromCharacter, createCombatState, resolveDamage, resolveMeleeAttack } from '../src/combat/engine';
import { engage } from '../src/combat/spatial';
import { applyEndOfRoundConditionEffects } from '../src/utils/conditions';

const talents = talentsData as Talent[];
const combatTalents = combatTalentsData as Talent[];

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

const spear: Weapon = {
    id: 'weapon_spear',
    name: 'Spear',
    group: 'polearm',
    price: '1 GC',
    enc: 2,
    reach: 'Long',
    damage: '+SB+4',
    qualities: [],
    availability: 'Common',
};

const mace: Weapon = {
    id: 'weapon_mace',
    name: 'Mace',
    group: 'basic',
    price: '1 GC',
    enc: 1,
    reach: 'Average',
    damage: '+SB+4',
    qualities: ['Pummel'],
    availability: 'Common',
};

describe('combat talent effects', () => {
    it('uses the normalized combat talent schema without passive or per-talent tied-test rows', () => {
        const allEffects = combatTalents.flatMap(talent => talent.effects || []);
        expect(allEffects.length).toBeGreaterThan(0);
        expect(allEffects.every(effect => 'kind' in effect)).toBe(true);
        expect(allEffects.some(effect => 'type' in effect && ['PASSIVE', 'SL_BONUS_ON_SUCCESS'].includes((effect as any).type))).toBe(false);
        expect(combatTalents.find(talent => talent.id === 'strike-mighty-blow')?.effects).toContainEqual(expect.objectContaining({ kind: 'damageBonus' }));
        expect(combatTalents.find(talent => talent.id === 'combat-master')?.effects).toContainEqual(expect.objectContaining({ kind: 'outnumberingCount' }));
        expect(combatTalents.find(talent => talent.id === 'iron-jaw')?.effects).toContainEqual(expect.objectContaining({ kind: 'conditionGainReaction' }));
    });

    it('catalogues combat talents and default-off optional activations', () => {
        const coverage = catalogueCombatTalentCoverage(combatTalents);
        expect(coverage.find(row => row.id === 'shieldsman')).toMatchObject({ classification: 'activated-or-reaction' });
        expect(coverage.find(row => row.id === 'furious-assault')).toMatchObject({ classification: 'deferred-action-economy' });
        expect(coverage.find(row => row.id === 'fearless')).toMatchObject({ classification: 'typed-wired' });
        expect(coverage.find(row => row.id === 'frightening')).toMatchObject({ classification: 'typed-wired' });
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
        ], { weapons: [shield], talents: combatTalents, advantagePools: { ally: 2, adversary: 0 } });
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
        expect(attack?.data.defenderRoll.roundedSuccessLevel).toBe(3);

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
        ], { weapons: [shield, dagger], talents: combatTalents });
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
        expect(evaluateTalentCondition('defendingWithShield', context)).toBe(true);
        expect(evaluateTalentCondition('when defending', context)).toBe(true);
        expect(evaluateTalentCondition('when attacking with two weapons', { ...context, role: 'attacker' })).toBe(true);
        expect(evaluateTalentCondition('charging', { ...context, action: { ...context.action, isCharging: false } })).toBe(false);
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
        ], { weapons: [rapier], talents: combatTalents });

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
            combatant('foe', 'Foe', { side: 'adversary', ws: 30 }),
        ], { weapons: [dagger], talents: combatTalents });

        const dual = resolveCombatAction(state, {
            kind: 'attackWithBoth',
            actorId: 'dual',
            targetId: 'foe',
            rollResult: 34,
            defenderRollResult: 90,
            defenderTargetNumber: 30,
            opponentRollResult: 90,
            opponentTargetNumber: 30,
        });
        expect(dual.events.find(event => event.type === 'TalentEffectApplied' && event.data.talentId === 'dual-wielder')).toMatchObject({
            data: { talentId: 'dual-wielder', effect: 'attackWithBoth' },
        });

        const extra = prepareTalentExtraAttack(state, 'dual', 'always');
        expect(extra.state.turnFlags.talentExtraAttackCombatantIds).toEqual(['dual']);
        expect(extra.events[0]).toMatchObject({ type: 'TalentEffectApplied', data: { talentId: 'furious-assault', effect: 'extraAttack' } });
    });

    it('derives tied-test SL bonuses centrally from tests and rank', () => {
        const state = createCombatState([
            combatant('attacker', 'Attacker', { ws: 50, talents: { 'battle-rage': 2, 'berserk-charge': 1 }, conditions: ['condition_frenzied'] }),
            combatant('defender', 'Defender', { side: 'adversary', ws: 30 }),
        ], { talents: combatTalents });

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 20, weaponDamage: 6 },
            defender: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90 },
            grantAdvantage: false,
            isCharging: true,
        });

        expect(result.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { attackerRoll: { roundedSuccessLevel: 7 } },
        });
    });

    it('wires melee and brawling damage talents plus charge-gated bonuses', () => {
        const state = createCombatState([
            combatant('attacker', 'Attacker', { talents: { 'strike-mighty-blow': 2, 'dirty-fighting': 1, 'berserk-charge': 1, resolute: 1 } }),
            combatant('defender', 'Defender', { side: 'adversary', toughness: 30, wounds: 20 }),
        ], { talents: combatTalents });

        const melee = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_basic',
            slDifference: 1,
            weaponDamage: 6,
            hitLocation: 'Body',
            isCharging: true,
        });
        expect(melee.events.find(event => event.type === 'DamageDealt')).toMatchObject({ data: { rawDamage: 11 } });

        const brawling = resolveDamage(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            skillId: 'melee_brawling',
            slDifference: 1,
            weaponDamage: 4,
            hitLocation: 'Body',
        });
        expect(brawling.events.find(event => event.type === 'DamageDealt')).toMatchObject({ data: { rawDamage: 8 } });
    });

    it('applies Robust reduction and Slayer damage calculation', () => {
        const state = createCombatState([
            combatant('slayer', 'Slayer', { strength: 30, talents: { slayer: 1 } }),
            combatant('robust', 'Robust', { side: 'adversary', toughness: 50, wounds: 20, talents: { robust: 2 } }),
        ], { talents: combatTalents });

        const result = resolveDamage(state, {
            attackerId: 'slayer',
            defenderId: 'robust',
            skillId: 'melee_basic',
            slDifference: 1,
            weaponDamage: 6,
            hitLocation: 'Body',
        });

        expect(result.events.find(event => event.type === 'DamageDealt')).toMatchObject({
            data: { rawDamage: 7, toughnessBonus: 5, damageDealt: 2 },
        });
    });

    it('wires Careful Strike, In-fighter, Strike to Stun, and Ambidextrous modifiers', () => {
        let state = createCombatState([
            combatant('attacker', 'Attacker', {
                ws: 50,
                talents: { 'careful-strike': 1, 'in-fighter': 1, 'strike-to-stun': 1, ambidextrous: 1 },
                weapons: { [dagger.id]: 1, [mace.id]: 1 },
                equippedWeapons: { [mace.id]: true },
            }),
            combatant('defender', 'Defender', {
                side: 'adversary',
                ws: 30,
                weapons: { [spear.id]: 1 },
                equippedWeapons: { [spear.id]: true },
            }),
        ], { weapons: [dagger, mace, spear], talents: combatTalents });
        state = engage(state, 'attacker', 'defender').state;

        const careful = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            chosenHitLocation: 'Body',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 34, weaponId: mace.id, weaponDamage: 6 },
            defender: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90, weaponId: spear.id },
            grantAdvantage: false,
        });
        expect(careful.events.find(event => event.type === 'AttackResolved')).toMatchObject({
            data: { hitLocation: 'Body', attackerRoll: { targetNumber: 50 } },
        });

        expect(calledShotPenaltyFor({
            state,
            attacker: state.combatants.attacker,
            defender: state.combatants.defender,
            action: {
                attackerId: 'attacker',
                defenderId: 'defender',
                chosenHitLocation: 'Head',
                attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 34, weaponId: mace.id },
                defender: { skillId: 'melee_basic', targetNumber: 30 },
            },
        })).toBe(0);
        const strikeToStun = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            chosenHitLocation: 'Head',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 40, weaponId: mace.id, weaponDamage: 6 },
            defender: { skillId: 'melee_basic', targetNumber: 30, rollResult: 90, weaponId: spear.id },
            grantAdvantage: false,
        });
        expect(strikeToStun.state.combatants.defender.conditions).toContain('condition_stunned');
        expect(strikeToStun.events).toContainEqual(expect.objectContaining({ type: 'TalentEffectApplied', data: expect.objectContaining({ talentId: 'strike-to-stun', effect: 'pummelStun' }) }));
        expect(offHandPenaltyFor(state.combatants.attacker)).toBe(-10);
    });

    it('wires critical talent events and Slayer larger-target damage multiplier', () => {
        const state = createCombatState([
            combatant('slayer', 'Slayer', { ws: 50, talents: { slayer: 1, 'strike-to-injure': 1 } }),
            combatant('ogre', 'Ogre', { side: 'adversary', ws: 20, toughness: 30, wounds: 40, tags: ['size:enormous'] }),
        ], { talents: combatTalents });

        const result = resolveMeleeAttack(state, {
            attackerId: 'slayer',
            defenderId: 'ogre',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 11, weaponDamage: 6 },
            defender: { skillId: 'melee_basic', targetNumber: 20, rollResult: 99 },
            grantAdvantage: false,
        });

        expect(result.events).toContainEqual(expect.objectContaining({ type: 'TalentEffectApplied', data: expect.objectContaining({ talentId: 'strike-to-injure', effect: 'chooseCriticalRoll' }) }));
        expect(result.events).toContainEqual(expect.objectContaining({ type: 'TalentEffectApplied', data: expect.objectContaining({ talentId: 'slayer', effect: 'largerTargetMultiplier', amount: 2 }) }));
        expect(result.events.find(event => event.type === 'DamageDealt')).toMatchObject({ data: { rawDamage: 42 } });
    });

    it('keeps Combat Master and Drilled in different Advantage calculations and lowers Relentless Flee cost', () => {
        let outnumbered = createCombatState([
            combatant('master', 'Master', { side: 'ally', talents: { 'combat-master': 3 } }),
            combatant('foe1', 'Foe 1', { side: 'adversary' }),
            combatant('foe2', 'Foe 2', { side: 'adversary' }),
        ], { talents: combatTalents });
        outnumbered = engage(outnumbered, 'master', 'foe1').state;
        outnumbered = engage(outnumbered, 'master', 'foe2').state;

        expect(seedInitialAdvantage({ state: outnumbered })).toEqual({ ally: 2, adversary: 0 });
        const attack = resolveMeleeAttack(outnumbered, {
            attackerId: 'foe1',
            defenderId: 'master',
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 50, weaponDamage: 6 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 80 },
            grantAdvantage: false,
        });
        expect(attack.events.find(event => event.type === 'AttackResolved')).toMatchObject({ data: { attackerRoll: { targetNumber: 40 } } });

        const drilled = createCombatState([
            combatant('drilled', 'Drilled', { side: 'ally', talents: { drilled: 1 } }),
            combatant('foe', 'Foe', { side: 'adversary' }),
        ], { talents: combatTalents, advantagePools: { ally: 0, adversary: 1 } });
        expect(reallocateEndOfRound(drilled).state.advantagePools).toEqual({ ally: 1, adversary: 0 });

        let fleeing = createCombatState([
            combatant('relentless', 'Relentless', { side: 'ally', talents: { relentless: 1 } }),
            combatant('foe', 'Foe', { side: 'adversary' }),
        ], { talents: combatTalents, advantagePools: { ally: 1, adversary: 0 } });
        fleeing = engage(fleeing, 'relentless', 'foe').state;
        expect(spendAdvantage(fleeing, 'ally', 'fleeFromHarm', { actorId: 'relentless' }).state.advantagePools.ally).toBe(0);
    });

    it('wires Implacable, Iron Jaw, and Jump Up condition reactions', () => {
        const implacable = applyEndOfRoundConditionEffects({
            name: 'Implacable',
            currentWounds: 10,
            conditions: ['condition_bleeding'],
            character: makeCharacter('implacable', 'Implacable', { talents: { implacable: 1 }, wounds: 10 }),
        }, 1);
        expect(implacable.combatant.currentWounds).toBe(10);
        expect(implacable.events.some(event => event.type === 'ConditionDamage')).toBe(false);

        const state = createCombatState([
            combatant('jaw', 'Jaw', { talents: { 'iron-jaw': 1 }, conditions: ['condition_stunned', 'condition_stunned'] }),
            combatant('jumper', 'Jumper', { talents: { 'jump-up': 1 }, conditions: ['condition_prone'] }),
        ], { talents: combatTalents });
        const jaw = resolveTalentConditionReaction(state, {
            talentId: 'iron-jaw',
            actorId: 'jaw',
            conditionId: 'condition_stunned',
            rollResult: 20,
            targetNumber: 40,
            policy: 'always',
        });
        expect(jaw.state.combatants.jaw.conditions).toEqual([]);
        expect(jaw.events[0]).toMatchObject({ type: 'TalentEffectApplied', data: { talentId: 'iron-jaw', effect: 'conditionRemoved', amount: 2 } });

        const jump = resolveTalentConditionReaction(state, {
            talentId: 'jump-up',
            actorId: 'jumper',
            conditionId: 'condition_prone',
            rollResult: 20,
            targetNumber: 40,
            policy: 'always',
        });
        expect(jump.state.combatants.jumper.conditions).toEqual([]);
    });
});

interface CombatantOptions {
    side?: 'ally' | 'adversary';
    ws?: number;
    wounds?: number;
    position?: number;
    strength?: number;
    toughness?: number;
    talents?: Record<string, number>;
    conditions?: string[];
    tags?: string[];
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
        conditions: (options.conditions ?? []).map(id => ({ id, name: id, description: '', stack: 1 })),
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
        ...(options.tags ? { tags: options.tags } : {}),
    };
}
