import { describe, expect, it } from 'vitest';
import type { Character, Characteristic, Weapon } from '../src/types/wfrp.types';
import {
    canBreakGrappleByPoolComparison,
    clearDefensiveBonusAtTurnStart,
    COMBAT_ACTION_DEFINITIONS,
    defensiveBonusForSkill,
    resolveCombatAction,
    resolveEffectiveWeapon,
    SECONDARY_HAND_PENALTY,
} from '../src/combat/actions';
import { spendAdvantage } from '../src/combat/advantage';
import { createCombatantFromCharacter, createCombatState, resolveDamage, resolveMeleeAttack } from '../src/combat/engine';
import { collectMeleePreRollModifiers, resolveModifierTotal } from '../src/combat/modifiers';
import {
    applyFortunePostRollHook,
    spendFate,
    spendFortune,
    tryInterceptDamageWithFate,
    tryInterceptDeathWithFate,
} from '../src/combat/resources';
import { createSeededRng } from '../src/combat/rng';
import { engage, engagementKey, isInfighting } from '../src/combat/spatial';

const spear: Weapon = {
    id: 'weapon_polearm_spear',
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
    id: 'weapon_basic_dagger',
    name: 'Dagger',
    group: 'basic',
    price: '16 S',
    enc: 0,
    reach: 'Very Short',
    damage: '+SB+2',
    qualities: [],
    availability: 'Common',
};

describe('special actions and resources', () => {
    it('exposes typed combat actions with costs and advantage flags', () => {
        expect(COMBAT_ACTION_DEFINITIONS.assess).toEqual({ kind: 'assess', cost: 'action', generatesAdvantage: false });
        expect(COMBAT_ACTION_DEFINITIONS.grappleBreak).toEqual({ kind: 'grappleBreak', cost: 'free', generatesAdvantage: false });
        expect(COMBAT_ACTION_DEFINITIONS.attack.generatesAdvantage).toBe(true);
    });

    it('grants Assess Advantage tiers at 2 and 3', () => {
        const base = createState([combatant('scout', 'Scout', { perception: 55 })]);
        const success = resolveCombatAction(base, {
            kind: 'assess',
            actorId: 'scout',
            skillId: 'perception',
            targetNumber: 55,
            rollResult: 20,
        });
        expect(success.state.advantagePools.ally).toBe(2);

        const high = resolveCombatAction(base, {
            kind: 'assess',
            actorId: 'scout',
            skillId: 'perception',
            targetNumber: 95,
            rollResult: 5,
        });
        expect(high.state.advantagePools.ally).toBe(3);
    });

    it('applies Defend +20 only for the nominated skill until the next turn', () => {
        const state = createState([combatant('guard', 'Guard', { meleeSkill: 45 })]);
        const defended = resolveCombatAction(state, {
            kind: 'defend',
            actorId: 'guard',
            skillId: 'melee_basic',
        }).state;

        expect(defensiveBonusForSkill(defended.combatants.guard, 'melee_basic', 0)).toBe(20);
        expect(defensiveBonusForSkill(defended.combatants.guard, 'dodge', 0)).toBe(0);

        const attack = resolveMeleeAttack(defended, {
            attackerId: 'enemy',
            defenderId: 'guard',
            attacker: { skillId: 'melee_basic', targetNumber: 40, rollResult: 80 },
            defender: { skillId: 'melee_basic', targetNumber: 45, rollResult: 50 },
        }, createSeededRng('defend-bonus'));
        expect(attack.events.find(event => event.type === 'AttackResolved')?.data.outcome).toBe('defender');

        const nextTurn = clearDefensiveBonusAtTurnStart({ ...defended, round: 1 }, 'guard');
        expect(defensiveBonusForSkill(nextTurn.combatants.guard, 'melee_basic', 1)).toBe(0);
    });

    it('resolves Sprint distance as Move + Run + SL', () => {
        const state = createState([combatant('runner', 'Runner', { movement: 4, athletics: 50 })]);
        const sprinted = resolveCombatAction(state, {
            kind: 'sprint',
            actorId: 'runner',
            targetNumber: 50,
            rollResult: 70,
            moveTarget: 30,
        });

        expect(sprinted.events.find(event => event.type === 'CombatActionResolved')).toMatchObject({
            data: { kind: 'sprint', outcome: 'success', distanceMoved: 24 },
        });
        expect(sprinted.state.combatants.runner.position).toBe(30);
    });

    it('sets outcome-driven in-fighting and substitutes improvised weapons', () => {
        let state = createState([
            combatant('spear', 'Spear', {
                weapons: { [spear.id]: 1 },
                equippedWeapons: { [spear.id]: true },
                position: 0,
            }),
            combatant('dagger', 'Dagger', {
                side: 'adversary',
                weapons: { [dagger.id]: 1 },
                equippedWeapons: { [dagger.id]: true },
                position: 1,
            }),
        ], undefined, [spear, dagger]);
        state = engage(state, 'spear', 'dagger').state;

        expect(isInfighting(state, 'spear', 'dagger')).toBe(false);

        state = resolveCombatAction(state, {
            kind: 'infighting',
            actorId: 'spear',
            targetId: 'dagger',
            rollResult: 10,
            targetNumber: 45,
            opponentRollResult: 90,
            opponentTargetNumber: 35,
            infightingMode: 'infighting',
        }).state;

        expect(isInfighting(state, 'spear', 'dagger')).toBe(true);
        const improvised = resolveEffectiveWeapon(state.combatants.spear, state, 'dagger');
        expect(improvised?.qualities).toEqual(['Undamaging', 'Unbalanced']);
        expect(improvised?.damage).toBe('+SB+1');
    });

    it('resolves both Disengage paths including failed-dodge free attacks', () => {
        const fleeState = createState([
            engagedCombatant('runner', 'Runner', ['enemy']),
            combatant('enemy', 'Enemy', { side: 'adversary', position: 1 }),
        ], { ally: 2, adversary: 0 });
        const fled = spendAdvantage(fleeState, 'ally', 'fleeFromHarm', { actorId: 'runner' });
        expect(fled.state.combatants.runner.engagementIds).toEqual([]);
        expect(fled.state.advantagePools.ally).toBe(0);

        const dodgeState = createState([
            engagedCombatant('dodger', 'Dodger', ['foe'], { dodge: 60 }),
            combatant('foe', 'Foe', { side: 'adversary', position: 1, meleeSkill: 35 }),
        ]);
        const success = resolveCombatAction(dodgeState, {
            kind: 'disengageDodge',
            actorId: 'dodger',
            rollResult: 10,
            targetNumber: 60,
            opponentRollResult: 80,
            opponentTargetNumber: 35,
            moveTarget: 20,
        });
        expect(success.state.combatants.dodger.engagementIds).toEqual([]);
        expect(success.state.advantagePools.ally).toBe(1);

        const failure = resolveCombatAction(dodgeState, {
            kind: 'disengageDodge',
            actorId: 'dodger',
            rollResult: 90,
            targetNumber: 60,
            opponentRollResult: 10,
            opponentTargetNumber: 35,
        });
        expect(failure.events.filter(event => event.type === 'BlowToBackAttackEvent')).toHaveLength(1);
        expect(failure.state.advantagePools.adversary).toBe(1);
    });

    it('handles grapple initiate, maintain, break, and outsider modifiers', () => {
        let state = createState([
            combatant('grappler', 'Grappler', { meleeSkill: 55, strength: 45 }),
            combatant('victim', 'Victim', { side: 'adversary', meleeSkill: 30, strength: 30, position: 1 }),
            combatant('outsider', 'Outsider', { meleeSkill: 40, position: 2 }),
        ], { ally: 2, adversary: 0 });
        state = engage(state, 'grappler', 'victim').state;

        state = resolveCombatAction(state, {
            kind: 'grappleInitiate',
            actorId: 'grappler',
            targetId: 'victim',
            rollResult: 10,
            targetNumber: 55,
            opponentRollResult: 80,
            opponentTargetNumber: 30,
        }).state;
        expect(state.combatants.victim.conditions).toContain('condition_entangled');
        expect(state.engagements[engagementKey('grappler', 'victim')]?.grappling).toBe(true);

        state = {
            ...state,
            combatants: {
                ...state.combatants,
                grappler: {
                    ...state.combatants.grappler,
                    budget: { ...state.combatants.grappler.budget, actions: 1 },
                },
            },
        };

        const maintained = resolveCombatAction(state, {
            kind: 'grappleMaintain',
            actorId: 'grappler',
            targetId: 'victim',
            rollResult: 5,
            targetNumber: 45,
            opponentRollResult: 90,
            opponentTargetNumber: 30,
        });
        expect(maintained.events.find(event => event.type === 'DamageDealt')?.data.damageDealt).toBeGreaterThan(0);

        expect(canBreakGrappleByPoolComparison({ ...state, advantagePools: { ally: 1, adversary: 3 } }, 'victim', 'grappler')).toBe(true);
        const broken = resolveCombatAction({ ...state, advantagePools: { ally: 1, adversary: 3 } }, {
            kind: 'grappleBreak',
            actorId: 'victim',
            targetId: 'grappler',
        });
        expect(broken.events.find(event => event.type === 'CombatActionResolved')?.data.outcome).toBe('success');
        expect(broken.state.engagements[engagementKey('grappler', 'victim')]?.grappling).toBe(false);

        const modifiers = resolveModifierTotal(collectMeleePreRollModifiers(state, {
            attackerId: 'outsider',
            defenderId: 'victim',
            attacker: { skillId: 'melee_basic', targetNumber: 40 },
            defender: { skillId: 'melee_basic', targetNumber: 30 },
        }, state.combatants.outsider, state.combatants.victim));
        expect(modifiers.sources.find(source => source.id === 'grapple:outsider')?.value).toBe(20);
    });

    it('applies off-hand -20 and exposes the dual-wield slot', () => {
        const state = createState([
            {
                ...combatant('dual', 'Dual', { meleeSkill: 50 }),
                character: {
                    ...combatant('dual', 'Dual', { meleeSkill: 50 }).character,
                    talents: { 'dual-wielder': 1 },
                },
                weaponLoadout: { primaryWeaponId: dagger.id, secondaryWeaponId: spear.id },
            },
            combatant('foe', 'Foe', { side: 'adversary', position: 1 }),
        ], { ally: 0, adversary: 0 }, [dagger, spear]);

        const modifiers = resolveModifierTotal(collectMeleePreRollModifiers(state, {
            attackerId: 'dual',
            defenderId: 'foe',
            hand: 'secondary',
            attacker: { skillId: 'melee_basic', targetNumber: 50 },
            defender: { skillId: 'melee_basic', targetNumber: 35 },
        }, state.combatants.dual, state.combatants.foe));
        expect(modifiers.total).toBe(SECONDARY_HAND_PENALTY);

        const slot = resolveCombatAction(state, { kind: 'attackWithBoth', actorId: 'dual' });
        expect(slot.events[0]).toMatchObject({ type: 'CombatActionResolved', data: { kind: 'attackWithBoth', outcome: 'applied' } });
    });

    it('supports Fortune reroll, +1 SL, and Act First hooks', () => {
        const state = createState([combatant('hero', 'Hero', { fate: 2, fortune: 2 })]);
        const reroll = spendFortune(state, 'hero', 'reroll', {
            policy: 'always',
            rollResult: 95,
            targetNumber: 50,
            pendingTestId: 'test-1',
        }, createSeededRng('fortune-reroll'));
        expect(reroll.state.combatants.hero.resources.fortune?.current).toBe(1);
        expect(reroll.events.some(event => event.type === 'FortuneModifierPreparedEvent')).toBe(true);

        const plusSl = spendFortune(state, 'hero', 'plusOneSl', { policy: 'always', pendingTestId: 'test-2' });
        const adjusted = applyFortunePostRollHook({
            skillId: 'melee_basic',
            rollResult: 40,
            targetNumber: 50,
            successLevel: 1,
            roundedSuccessLevel: 1,
            usedTalents: [],
        }, { slBonus: 1 });
        expect(adjusted.roundedSuccessLevel).toBe(2);

        const actFirst = spendFortune(state, 'hero', 'actFirst', { policy: 'always' });
        expect(actFirst.state.combatants.hero.initiativeOverride).toBe(true);
    });

    it('intercepts death and damage via Fate and decrements max Fate', () => {
        const state = createState([combatant('pc', 'PC', { fate: 2, fortune: 2, isPlayer: true })]);
        const death = tryInterceptDeathWithFate(state, 'pc', 'always');
        expect(death.intercepted).toBe(true);
        expect(death.state.combatants.pc.removedFromEncounter).toBe(true);
        expect(death.state.combatants.pc.resources.fate?.current).toBe(1);
        expect(death.state.combatants.pc.resources.fate?.max).toBe(1);
        expect(death.state.combatants.pc.resources.fortune?.max).toBe(1);

        const damageState = createState([
            combatant('target', 'Target', { fate: 1, fortune: 1, wounds: 10 }),
            combatant('foe', 'Foe', { side: 'adversary' }),
        ]);
        const damage = resolveDamage(damageState, {
            attackerId: 'foe',
            defenderId: 'target',
            skillId: 'melee_basic',
            slDifference: 2,
            weaponDamage: 5,
            fatePolicy: 'always',
        });
        expect(damage.events.some(event => event.type === 'FateInterceptionEvent')).toBe(true);
        expect(damage.state.combatants.target.currentWounds).toBe(10);

        const spent = spendFate(state, 'pc', 'dieAnotherDay', { policy: 'always' });
        expect(spent.state.combatants.pc.resources.fate?.max).toBe(1);
    });

    it('keeps identical seeded outcomes', () => {
        const run = () => resolveCombatAction(createState([
            engagedCombatant('a', 'A', ['b'], { perception: 50 }),
            combatant('b', 'B', { side: 'adversary', position: 1 }),
        ], { ally: 0, adversary: 0 }), {
            kind: 'assess',
            actorId: 'a',
            skillId: 'perception',
            targetNumber: 50,
            rollResult: 25,
        }, createSeededRng('special-actions-seed'));

        expect(run()).toEqual(run());
    });
});

function createState(
    combatants: ReturnType<typeof createCombatantFromCharacter>[],
    advantagePools?: { ally: number; adversary: number },
    weapons: Weapon[] = []
) {
    if (!combatants.some(combatant => combatant.id === 'enemy')) {
        combatants.push(combatant('enemy', 'Enemy', { side: 'adversary', meleeSkill: 40, position: 1 }));
    }
    return createCombatState(combatants, { advantagePools, weapons });
}

function engagedCombatant(
    id: string,
    name: string,
    engagedIds: string[],
    options: CombatantOptions = {}
) {
    return {
        ...combatant(id, name, options),
        engagementIds: engagedIds,
        position: options.position ?? 0,
    };
}

interface CombatantOptions {
    side?: 'ally' | 'adversary';
    meleeSkill?: number;
    perception?: number;
    athletics?: number;
    dodge?: number;
    strength?: number;
    movement?: number;
    wounds?: number;
    fate?: number;
    fortune?: number;
    isPlayer?: boolean;
    position?: number;
    weapons?: Record<string, number>;
    equippedWeapons?: Record<string, boolean>;
}

function combatant(id: string, name: string, options: CombatantOptions = {}) {
    const skills = [];
    if (options.meleeSkill) skills.push(skill('melee_basic', 'Melee (Basic)', 'ws', options.meleeSkill));
    if (options.perception) skills.push(skill('perception', 'Perception', 'i', options.perception));
    if (options.athletics) skills.push(skill('athletics', 'Athletics', 'ag', options.athletics));
    if (options.dodge) skills.push(skill('dodge', 'Dodge', 'ag', options.dodge));
    skills.push(skill('heal', 'Heal', 'i', 40));

    return createCombatantFromCharacter(makeCharacter(id, name, {
        ws: options.meleeSkill ?? 35,
        ag: options.dodge ?? options.athletics ?? 33,
        s: options.strength ?? 30,
        movement: options.movement ?? 4,
        wounds: options.wounds ?? 12,
        fate: options.fate ?? 0,
        fortune: options.fortune ?? 0,
        isPlayer: options.isPlayer,
        skills,
        weapons: options.weapons,
        equippedWeapons: options.equippedWeapons,
    }), {
        id,
        side: options.side ?? 'ally',
        position: options.position ?? 0,
    });
}

function skill(id: string, name: string, characteristic: string, value: number) {
    return { id, name, characteristic, advances: value - 33, talents: 0, modifier: 0 };
}

function makeCharacter(
    id: string,
    name: string,
    options: {
        ws?: number;
        ag?: number;
        s?: number;
        movement?: number;
        wounds?: number;
        fate?: number;
        fortune?: number;
        isPlayer?: boolean;
        skills?: Character['skills'];
        weapons?: Record<string, number>;
        equippedWeapons?: Record<string, boolean>;
    } = {}
): Character {
    const characteristic = (value: number): Characteristic => ({
        initial: value,
        advances: 0,
        talents: 0,
        modifier: 0,
    });

    const fateMax = options.fate ?? 0;
    const fortuneMax = options.fortune ?? fateMax;

    return {
        id,
        name,
        species: 'human',
        class: 'warrior',
        currentCareerId: 'career-1',
        currentCareerLevelId: 'career-level-1',
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedTalentIds: [],
        unlockedSkillIds: [],
        status: {
            wounds: { current: options.wounds ?? 12, max: options.wounds ?? 12 },
            fate: { current: fateMax, max: fateMax },
            fortune: { current: fortuneMax, max: fortuneMax },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        movement: options.movement ?? 4,
        characteristics: {
            ws: characteristic(options.ws ?? 33),
            bs: characteristic(28),
            s: characteristic(options.s ?? 30),
            t: characteristic(30),
            ag: characteristic(options.ag ?? 33),
            dex: characteristic(28),
            int: characteristic(28),
            wp: characteristic(28),
            fel: characteristic(28),
            i: characteristic(28),
        },
        skills: options.skills ?? [],
        talents: {},
        inventory: {
            weapons: options.weapons ?? {},
            equippedWeapons: options.equippedWeapons ?? {},
            armor: {},
            equippedArmor: {},
            items: {},
        },
        conditions: [],
        tags: options.isPlayer ? ['pc'] : [],
        userId: options.isPlayer ? 'user-1' : null,
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
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
    };
}
