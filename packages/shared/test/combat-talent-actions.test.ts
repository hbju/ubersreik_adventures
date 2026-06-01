import { describe, expect, it } from 'vitest';
import type { Character, Talent, Weapon } from '../src/types/wfrp.types';
import { grantAdvantage } from '../src/combat/advantage';
import { resolveCombatAction } from '../src/combat/actions';
import { createCombatantFromCharacter, createCombatState, resolveMeleeAttack } from '../src/combat/engine';
import { engage } from '../src/combat/spatial';
import { resolveTalentActivation } from '../src/combat/talents';
import { resolveTalentCombatAction, toggleReversal } from '../src/combat/talent-actions';
import { createSeededRng } from '../src/combat/rng';

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

describe('combat talent actions (3g-2)', () => {
    it('enforces Shieldsman once per turn and both modes', () => {
        let state = createCombatState([
            combatant('attacker', { side: 'adversary', position: 0 }),
            combatant('shield', {
                talents: { shieldsman: 1 },
                weapons: { [shield.id]: 1 },
                equippedWeapons: { [shield.id]: true },
                position: 1,
            }),
        ], { weapons: [shield], advantagePools: { ally: 4, adversary: 0 } });
        state = engage(state, 'attacker', 'shield').state;

        const first = resolveTalentActivation(state, {
            talentId: 'shieldsman',
            actorId: 'shield',
            targetId: 'attacker',
            trigger: 'onDefend',
            effect: 'push',
            policy: 'always',
        });
        expect(first.state.advantagePools.ally).toBe(2);
        expect(first.state.turnFlags.shieldsmanUsedThisTurnIds).toContain('shield');

        const second = resolveTalentActivation(first.state, {
            talentId: 'shieldsman',
            actorId: 'shield',
            targetId: 'attacker',
            trigger: 'onDefend',
            effect: 'damage',
            policy: 'always',
        });
        expect(second.events[0]).toMatchObject({ type: 'TalentActivationRejected', data: { talentId: 'shieldsman' } });
    });

    it('applies Beat Blade SL tiers with pool floor at zero', () => {
        let state = createCombatState([
            combatant('blade', { talents: { 'beat-blade': 1 }, ws: 50 }),
            combatant('foe', {
                side: 'adversary',
                ws: 40,
                weapons: { [rapier.id]: 1 },
                equippedWeapons: { [rapier.id]: true },
                loadout: { primaryWeaponId: rapier.id },
            }),
        ], { weapons: [rapier], advantagePools: { ally: 0, adversary: 1 } });

        const low = resolveTalentCombatAction(state, {
            kind: 'beatBlade',
            actorId: 'blade',
            targetId: 'foe',
            rollResult: 30,
            targetNumber: 50,
            policy: 'always',
        });
        expect(low.state.advantagePools.adversary).toBe(0);

        state = createCombatState([
            combatant('blade', { talents: { 'beat-blade': 1 }, ws: 50 }),
            combatant('foe', {
                side: 'adversary',
                ws: 40,
                weapons: { [rapier.id]: 1 },
                equippedWeapons: { [rapier.id]: true },
                loadout: { primaryWeaponId: rapier.id },
            }),
        ], { weapons: [rapier], advantagePools: { ally: 0, adversary: 3 } });

        const high = resolveTalentCombatAction(state, {
            kind: 'beatBlade',
            actorId: 'blade',
            targetId: 'foe',
            rollResult: 1,
            targetNumber: 60,
            policy: 'always',
        });
        expect(high.state.advantagePools.adversary).toBe(1);
    });

    it('transfers Advantage on Reversal when defending (no default defender pool gain)', () => {
        let state = createCombatState([
            combatant('defender', { talents: { reversal: 1 }, ws: 50 }),
            combatant('attacker', { side: 'adversary', ws: 30 }),
        ], { advantagePools: { ally: 0, adversary: 2 } });

        state = toggleReversal(state, 'defender', true, 'always').state;

        const result = resolveMeleeAttack(state, {
            attackerId: 'attacker',
            defenderId: 'defender',
            attacker: { skillId: 'melee_basic', targetNumber: 30, rollResult: 80 },
            defender: { skillId: 'melee_basic', targetNumber: 50, rollResult: 20 },
            grantAdvantage: true,
        });

        expect(result.state.advantagePools.adversary).toBe(1);
        expect(result.state.advantagePools.ally).toBe(1);
        expect(result.events.some(event => event.type === 'TalentEffectApplied' && event.data.talentId === 'reversal')).toBe(true);
    });

    it('blocks Advantage generation for Distract until end of next round', () => {
        let state = createCombatState([
            combatant('trickster', { talents: { distract: 1 }, ag: 40 }),
            combatant('mark', { side: 'adversary', wp: 30 }),
        ], { round: 2 });

        state = resolveTalentCombatAction(state, {
            kind: 'distractOpponent',
            actorId: 'trickster',
            targetId: 'mark',
            rollResult: 20,
            targetNumber: 40,
            opponentRollResult: 90,
            opponentTargetNumber: 30,
            policy: 'always',
        }).state;

        const blocked = grantAdvantage(state, 'adversary', 1, { sourceCombatantId: 'mark' });
        expect(blocked.events[0]).toMatchObject({ type: 'AdvantageGainBlocked' });

        const allowed = grantAdvantage({ ...state, round: 4 }, 'adversary', 1, { sourceCombatantId: 'mark' });
        expect(allowed.state.advantagePools.adversary).toBe(1);
    });

    it('resolves Disarm with grab at 6+ SL when a hand is free', () => {
        const state = createCombatState([
            combatant('duellist', { talents: { disarm: 1 }, ws: 55, loadout: { primaryWeaponId: rapier.id } }),
            combatant('foe', {
                side: 'adversary',
                ws: 40,
                weapons: { [dagger.id]: 1 },
                equippedWeapons: { [dagger.id]: true },
                loadout: { primaryWeaponId: dagger.id },
            }),
        ], { weapons: [rapier, dagger] });

        const result = resolveTalentCombatAction(state, {
            kind: 'disarm',
            actorId: 'duellist',
            targetId: 'foe',
            rollResult: 4,
            targetNumber: 60,
            opponentRollResult: 95,
            opponentTargetNumber: 40,
            policy: 'always',
        });

        expect(result.events[0]).toMatchObject({ data: { effect: 'disarmedAndGrabbed' } });
        expect(result.state.combatants.duellist.weaponLoadout?.primaryWeaponId).toBe(dagger.id);
    });

    it('stores and consumes a single-use Feint buff against the right target', () => {
        let state = createCombatState([
            combatant('fencer', { talents: { feint: 1 }, ws: 50, weapons: { [rapier.id]: 1 }, equippedWeapons: { [rapier.id]: true }, loadout: { primaryWeaponId: rapier.id } }),
            combatant('foe', {
                side: 'adversary',
                ws: 40,
                weapons: { [dagger.id]: 1 },
                equippedWeapons: { [dagger.id]: true },
                loadout: { primaryWeaponId: dagger.id },
            }),
        ], { weapons: [rapier, dagger], round: 1 });

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

        expect(state.combatants.fencer.feintBuffs).toEqual([expect.objectContaining({ opponentId: 'foe', slBonus: 5 })]);

        const attack = resolveMeleeAttack(state, {
            attackerId: 'fencer',
            defenderId: 'foe',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 40 },
            defender: { skillId: 'melee_basic', targetNumber: 40, rollResult: 70 },
            grantAdvantage: false,
        });

        expect(attack.state.combatants.fencer.feintBuffs).toEqual([]);
        expect(attack.events.find(event => event.type === 'MeleeHookPhase' && event.data.phase === 'preRollModifiers')).toBeTruthy();
    });

    it('runs the Dual Wielder sequence with reversed dice, crit reuse, and both-hit Advantage', () => {
        const rng = createSeededRng('dual-wield-3g2');

        let state = createCombatState([
            combatant('dual', {
                talents: { 'dual-wielder': 1, ambidextrous: 2 },
                ag: 40,
                ws: 50,
                weapons: { [dagger.id]: 2 },
                equippedWeapons: { [dagger.id]: true },
                loadout: { primaryWeaponId: dagger.id, secondaryWeaponId: dagger.id },
            }),
            combatant('foe', { side: 'adversary', ws: 30, wounds: 20 }),
        ], { weapons: [dagger] });

        const dual = resolveCombatAction(state, {
            kind: 'attackWithBoth',
            actorId: 'dual',
            targetId: 'foe',
            rollResult: 20,
            defenderRollResult: 95,
            defenderTargetNumber: 30,
            opponentRollResult: 95,
            opponentTargetNumber: 30,
        }, rng);

        expect(dual.state.combatants.dual.dualWieldDefensivePenalty).toBe(true);
        expect(dual.events.filter(event => event.type === 'AttackResolved')).toHaveLength(2);
        const talentEvent = dual.events.find(event => event.type === 'TalentEffectApplied' && event.data.talentId === 'dual-wielder');
        expect(talentEvent?.data).toMatchObject({ primaryHit: true, secondaryHit: true });
        expect(dual.state.advantagePools.ally).toBe(1);
    });
});

function combatant(
    id: string,
    options: {
        side?: 'ally' | 'adversary';
        ws?: number;
        ag?: number;
        wp?: number;
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
        s: char(30),
        t: char(30),
        i: char(30),
        ag: char(options.ag ?? 30),
        dex: char(30),
        int: char(30),
        wp: char(options.wp ?? 30),
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
            { id: 'melee_fencing', name: 'Melee (Fencing)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
            { id: 'athletics', name: 'Athletics', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
            { id: 'cool', name: 'Cool', characteristic: 'wp', advances: 0, talents: 0, modifier: 0 },
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
