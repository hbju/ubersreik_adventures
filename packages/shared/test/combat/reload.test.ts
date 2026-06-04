import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import type { CombatEngineResult, CombatState, RangedShotRejectedEvent } from '../../src/combat';
import {
    applyReloadInterruptGuard,
    createCombatState,
    createCombatantFromCharacter,
    resolveCombatAction,
    resolveExtendedTest,
    resolveMeleeAttack,
    resolveRangedAttack,
    resolveReloadAction,
    resolveTalentActivation,
} from '../../src/combat';
import { applyEndOfRoundConditionEffects } from '../../src/utils/conditions';

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

const handgun: Weapon = {
    ...bow,
    id: 'handgun',
    name: 'Handgun',
    group: 'blackpowder',
    damage: '+9',
    qualities: ['Reload 3', 'Blackpowder'],
};

const repeater: Weapon = {
    ...handgun,
    id: 'repeater',
    name: 'Repeater Handgun',
    qualities: ['Reload 4', 'Repeater 4', 'Blackpowder'],
};

const distractingSword: Weapon = {
    ...bow,
    id: 'distracting-sword',
    name: 'Distracting Sword',
    group: 'basic',
    reach: 'Average',
    damage: '+SB+4',
    qualities: ['Distract'],
};

const shield: Weapon = {
    ...bow,
    id: 'shield',
    name: 'Shield',
    group: 'basic',
    reach: 'Short',
    damage: '+SB+1',
    qualities: ['Shield 2'],
};

describe('ranged reload and ammunition 4b', () => {
    it('accumulates and resets generic Extended Tests', () => {
        const first = resolveExtendedTest({ progress: null, targetSL: 5, successLevel: 2 });
        const second = resolveExtendedTest({ progress: first.progress, targetSL: 5, successLevel: 3 });
        const reset = resolveExtendedTest({ progress: first.progress, targetSL: 5, successLevel: 1, reset: true });

        expect(first).toEqual({ accumulatedSL: 2, completed: false, progress: { accumulatedSL: 2, targetSL: 5 } });
        expect(second.completed).toBe(true);
        expect(second.progress).toBeNull();
        expect(reset.accumulatedSL).toBe(1);
    });

    it('consumes a single loaded shot and reloads through an Extended Ranged Test', () => {
        const attacker = combatant('attacker', 'ally', ['handgun'], 0);
        const target = combatant('target', 'adversary', [], 20);
        let state = createCombatState([attacker, target], { weapons: [handgun] });

        const fired = resolveRangedAttack(state, shot('attacker', 'target', 'handgun', 24));
        state = fired.state;
        expect(state.combatants.attacker.weaponAmmo?.handgun.loaded).toBe(false);

        const blocked = resolveRangedAttack(state, shot('attacker', 'target', 'handgun', 24));
        expect(blocked.events[0].type).toBe('RangedShotRejected');
        expect((blocked.events[0] as RangedShotRejectedEvent).data.reason).toBe('unloaded');

        const partial = resolveReloadAction(state, { actorId: 'attacker', weaponId: 'handgun', targetNumber: 50, rollResult: 30 });
        state = partial.state;
        expect(state.combatants.attacker.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 2, targetSL: 3 });
        expect(state.combatants.attacker.weaponAmmo?.handgun.loaded).toBe(false);
        state = refreshAction(state, 'attacker');

        const complete = resolveReloadAction(state, { actorId: 'attacker', weaponId: 'handgun', targetNumber: 50, rollResult: 40 });
        state = complete.state;
        expect(complete.events.find(event => event.type === 'ReloadTestResolved')?.data.completed).toBe(true);
        expect(state.combatants.attacker.weaponAmmo?.handgun).toEqual({ loaded: true, reloadProgress: null });
    });

    it('blocks firing while reload progress is active', () => {
        const attacker = combatant('attacker', 'ally', ['handgun'], 0, {
            weaponAmmo: { handgun: { loaded: false, reloadProgress: { accumulatedSL: 2, targetSL: 3 } } },
        });
        const target = combatant('target', 'adversary', [], 20);
        const state = createCombatState([attacker, target], { weapons: [handgun] });

        const blocked = resolveRangedAttack(state, shot('attacker', 'target', 'handgun', 24));

        expect((blocked.events[0] as RangedShotRejectedEvent).data.reason).toBe('reloading');
    });

    it('lets Repeaters fire their rating before forcing reload', () => {
        const attacker = combatant('attacker', 'ally', ['repeater'], 0);
        const target = combatant('target', 'adversary', [], 20);
        let state = createCombatState([attacker, target], { weapons: [repeater] });

        for (let index = 3; index >= 0; index--) {
            const fired = resolveRangedAttack(state, shot('attacker', 'target', 'repeater', 24 + index));
            state = fired.state;
            expect(fired.events.some(event => event.type === 'RangedShotRejected')).toBe(false);
            expect(state.combatants.attacker.weaponAmmo?.repeater.shotsRemaining).toBe(index);
        }

        const empty = resolveRangedAttack(state, shot('attacker', 'target', 'repeater', 24));
        expect((empty.events[0] as RangedShotRejectedEvent).data.reason).toBe('unloaded');
    });

    it('keeps weapons without Reload ready without ammo state tracking', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0);
        const target = combatant('target', 'adversary', [], 20);
        let state = createCombatState([attacker, target], { weapons: [bow] });

        state = resolveRangedAttack(state, shot('attacker', 'target', 'bow', 24)).state;
        state = resolveRangedAttack(state, shot('attacker', 'target', 'bow', 25)).state;

        expect(state.combatants.attacker.weaponAmmo?.bow).toBeUndefined();
    });

    it('applies Gunner and Rapid Reload via reload SL hooks and grants Rapid Reload Assess Advantage', () => {
        const attacker = combatant('attacker', 'ally', ['handgun'], 0, {
            talents: { gunner: 2, 'rapid-reload': 1 },
            weaponAmmo: { handgun: { loaded: false, reloadProgress: null } },
        });
        const target = combatant('target', 'adversary', [], 20);
        const state = createCombatState([attacker, target], { weapons: [handgun] });

        const result = resolveReloadAction(state, { actorId: 'attacker', weaponId: 'handgun', targetNumber: 50, rollResult: 50 });
        const reload = result.events.find(event => event.type === 'ReloadTestResolved');

        expect(reload?.data.successLevel).toBe(3);
        expect(reload?.data.slModifier).toBe(3);
        expect(reload?.data.completed).toBe(true);
        expect(result.state.combatants.attacker.weaponAmmo?.handgun.loaded).toBe(true);
        expect(result.state.advantagePools.ally).toBe(3);
    });

    it('depletes optional finite ammunition and blocks empty weapons', () => {
        const attacker = combatant('attacker', 'ally', ['bow'], 0, { ammunition: { bow: 1 } });
        const target = combatant('target', 'adversary', [], 20);
        let state = createCombatState([attacker, target], { weapons: [bow], ammoPolicy: { finiteAmmo: true } });

        const first = resolveRangedAttack(state, shot('attacker', 'target', 'bow', 24));
        state = first.state;
        const second = resolveRangedAttack(state, shot('attacker', 'target', 'bow', 24));

        expect(state.combatants.attacker.ammunition?.bow).toBe(0);
        expect(first.events.find(event => event.type === 'AmmoStateChanged')?.data.ammunitionRemaining).toBe(0);
        expect((second.events[0] as RangedShotRejectedEvent).data.reason).toBe('outOfAmmo');
    });

    it('interrupts reload when attacked and defending, even on a winning Dodge', () => {
        const shooter = combatant('shooter', 'ally', ['bow'], 0);
        const defender = combatant('defender', 'adversary', ['handgun'], 4, { weaponAmmo: midReload() });
        const state = createCombatState([shooter, defender], { weapons: [bow, handgun] });

        const result = resolveRangedAttack(state, {
            attackerId: 'shooter',
            defenderId: 'defender',
            distance: 4,
            defenceKind: 'pointBlankDodge',
            attacker: { skillId: 'ranged_bow', targetNumber: 50, rollResult: 45, weaponId: 'bow' },
            defender: { skillId: 'dodge', targetNumber: 90, rollResult: 1 },
        });

        expect(result.events.find(event => event.type === 'AttackResolved')?.data.outcome).toBe('defender');
        expect(result.state.combatants.defender.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 0, targetSL: 3 });
        expect(interruptCount((result as CombatEngineResult).events as any)).toBe(1);
    });

    it('interrupts reload from end-of-round condition damage', () => {
        const subject = combatant('burning', 'ally', ['handgun'], 0, {
            conditions: ['condition_bleeding'],
            weaponAmmo: midReload(),
        });

        const result = applyEndOfRoundConditionEffects(subject, 1);

        expect(result.events.some(event => event.type === 'ConditionDamage')).toBe(true);
        expect(result.combatant.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 0, targetSL: 3 });
        expect(result.events.filter(event => event.type === 'AmmoStateChanged')).toHaveLength(1);
    });

    it('interrupts reload from Distract and Shieldsman push effects', () => {
        const distractor = combatant('distractor', 'ally', ['distracting-sword'], 0);
        const target = combatant('target', 'adversary', ['handgun'], 1, { weaponAmmo: midReload() });
        const distracted = resolveMeleeAttack(createCombatState([distractor, target], { weapons: [distractingSword, handgun] }), {
            attackerId: 'distractor',
            defenderId: 'target',
            attacker: { skillId: 'melee_basic', targetNumber: 50, rollResult: 20, weaponId: 'distracting-sword' },
            defender: { skillId: 'melee_basic', targetNumber: 20, rollResult: 90 },
        });

        const shieldBearer = combatant('shield', 'ally', ['shield'], 0, { talents: { shieldsman: 1 } });
        const pushedTarget = combatant('pushed', 'adversary', ['handgun'], 1, { weaponAmmo: midReload() });
        const pushed = resolveTalentActivation(createCombatState([shieldBearer, pushedTarget], {
            weapons: [shield, handgun],
            advantagePools: { ally: 2, adversary: 0 },
        }), {
            talentId: 'shieldsman',
            actorId: 'shield',
            targetId: 'pushed',
            trigger: 'onDefend',
            effect: 'push',
            policy: 'always',
        });

        expect(distracted.events.some(event => event.type === 'QualityEffectApplied' && event.data.effect === 'push')).toBe(true);
        expect(distracted.state.combatants.target.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 0, targetSL: 3 });
        expect(pushed.events.some(event => event.type === 'TalentEffectApplied' && event.data.effect === 'push')).toBe(true);
        expect(pushed.state.combatants.pushed.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 0, targetSL: 3 });
    });

    it('interrupts reload when choosing a non-reload action but continuing reload progresses', () => {
        const actor = combatant('actor', 'ally', ['handgun'], 0, { weaponAmmo: midReload() });
        const target = combatant('target', 'adversary', [], 20);
        const action = resolveCombatAction(createCombatState([actor, target], { weapons: [handgun] }), {
            kind: 'assess',
            actorId: 'actor',
            skillId: 'ranged_blackpowder',
            targetNumber: 50,
            rollResult: 40,
        });

        const reloader = combatant('reloader', 'ally', ['handgun'], 0, { weaponAmmo: midReload() });
        const reload = resolveReloadAction(createCombatState([reloader], { weapons: [handgun] }), {
            actorId: 'reloader',
            weaponId: 'handgun',
            targetNumber: 50,
            rollResult: 40,
        });

        expect(action.state.combatants.actor.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 0, targetSL: 3 });
        expect(reload.state.combatants.reloader.weaponAmmo?.handgun.reloadProgress).toBeNull();
        expect(interruptCount((reload as CombatEngineResult).events as any)).toBe(0);
    });

    it('deduplicates multiple interrupts landing in one step', () => {
        const target = combatant('target', 'ally', ['handgun'], 0, { weaponAmmo: midReload() });
        const state = createCombatState([target], { weapons: [handgun] });

        const guarded = applyReloadInterruptGuard({
            state,
            events: [
                {
                    type: 'DamageDealt',
                    i18nKey: 'combat.damage.dealt',
                    data: {
                        attackerId: 'other',
                        defenderId: 'target',
                        defenderName: 'target',
                        hitLocation: 'Body',
                        rawDamage: 1,
                        damageDealt: 1,
                        toughnessBonus: 0,
                        armourPoints: 0,
                        minimumOneWoundApplied: false,
                        woundsBeyondZero: 0,
                        woundsBefore: 10,
                        woundsAfter: 9,
                    },
                },
                {
                    type: 'MovedEvent',
                    i18nKey: 'combat.movement.moved',
                    data: {
                        combatantId: 'target',
                        combatantName: 'target',
                        mode: 'walk',
                        from: 0,
                        to: 1,
                        distance: 1,
                        actionSpent: false,
                        remainingMovement: 7,
                    },
                },
            ],
        });

        expect(guarded.state.combatants.target.weaponAmmo?.handgun.reloadProgress).toEqual({ accumulatedSL: 0, targetSL: 3 });
        expect(interruptCount((guarded as CombatEngineResult).events as any)).toBe(1);
    });
});

function shot(attackerId: string, defenderId: string, weaponId: string, rollResult: number) {
    return {
        attackerId,
        defenderId,
        distance: 20,
        attacker: { skillId: weaponId === 'bow' ? 'ranged_bow' : 'ranged_blackpowder', targetNumber: 50, rollResult, weaponId },
    };
}

function refreshAction(state: CombatState, combatantId: string): CombatState {
    const actor = state.combatants[combatantId];
    return {
        ...state,
        combatants: {
            ...state.combatants,
            [combatantId]: { ...actor, budget: { ...actor.budget, actions: 1 } },
        },
    };
}

function midReload() {
    return { handgun: { loaded: false, reloadProgress: { accumulatedSL: 2, targetSL: 3 } } };
}

function interruptCount(events: Array<{ type: string; data?: { reason?: string } }>): number {
    return events.filter(event => event.type === 'AmmoStateChanged' && event.data?.reason === 'interrupted').length;
}

function combatant(id: string, side: 'ally' | 'adversary', weapons: string[], position: number, overrides: Record<string, unknown> = {}) {
    const character = characterFixture(id, weapons, overrides.talents as Record<string, number> | undefined);
    return {
        ...createCombatantFromCharacter(character, {
            id,
            side,
            position,
            conditions: overrides.conditions as string[] | undefined,
            weaponLoadout: { primaryWeaponId: weapons[0] },
            weaponAmmo: overrides.weaponAmmo as never,
            ammunition: overrides.ammunition as never,
        }),
    };
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
            { id: 'ranged_bow', name: 'Ranged (Bow)', characteristic: 'bs', advances: 0, talents: 0, modifier: 0 },
            { id: 'ranged_blackpowder', name: 'Ranged (Blackpowder)', characteristic: 'bs', advances: 0, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 0, talents: 0, modifier: 0 },
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 0, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: 99, max: 99 },
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
